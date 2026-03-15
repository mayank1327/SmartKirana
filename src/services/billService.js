const mongoose = require('mongoose');
const billRepository = require('../repositories/billRepository');
const productRepository = require('../repositories/productRepository');
const temporaryProductService = require('./temporaryProductService');
const AppError = require('../utils/AppError'); 

class BillService {
  
  validatePricing(price, costPrice, msp, productName, variationName) {
    const warnings = [];
    
    // Block if price < cost
    if (price < costPrice) {
      throw new AppError( `Cannot sell ${productName} (${variationName}) at ₹${price}. Cost price is ₹${costPrice}`, 400);
    }
    
    // Warn if price < MSP (but allow)
    if (msp && price < msp) {
      warnings.push({
        type: 'BELOW_MSP',
        message: `Selling ${productName} (${variationName}) below minimum price`,
        details: {
          productName,
          variationName,
          msp,
          soldAt: price
        }
      });
    }
    
    return warnings;
  }
  
  calculateEffectivePrice(lineTotal, quantity) {
    return Math.round(lineTotal / quantity);
  }

  convertToBaseUnit(quantity, conversionToBase) {
    return quantity * conversionToBase;
  }
  
  checkStockAvailability(product, variation, quantity) {
    const warnings = [];
    
    // Calculate required stock in base unit
    const requiredStock = this.convertToBaseUnit(quantity, variation.conversionToBase);
    
    /* Check if sufficient
     * Non-blocking — negative stock allowed
     * Real shops often sell on credit before stock arrives
     * Stock will go negative — owner is warned */
    if (product.currentStock < requiredStock) {
      const availableInVariation = Math.floor(product.currentStock / variation.conversionToBase);
      
      warnings.push({
        type: 'INSUFFICIENT_STOCK',
        message: `Insufficient stock for ${product.productName} (${variation.variationName})`,
        details: {
          productName: product.productName,
          variationName: variation.variationName,
          requested: quantity,
          available: availableInVariation,
          willBeNegative: true,
          newStock: product.currentStock - requiredStock
        }
      });
    }
    
    return warnings;
  }
  
  processTemporaryProductItem(item) {
    const { productName, quantity, pricePerUnit, lineTotal } = item;
    
    const effectivePrice = lineTotal ? this.calculateEffectivePrice(lineTotal, quantity) : pricePerUnit;
    
    const actualLineTotal = lineTotal || (quantity * pricePerUnit);
    
    return {
      effectivePrice,
      actualLineTotal,
      warnings: [],
      billItem: {
        isTemporary: true,
        productId: null,
        variationId: null,
        variationName: null,
        productName,
        quantity,
        pricePerUnit,
        effectivePricePerUnit: effectivePrice,
        lineTotal: actualLineTotal
      }
    };
  }

  async processExistingProductItem(item, userId, session) {
    const { productId, variationId, quantity, pricePerUnit, lineTotal } = item;
    
    const product = await productRepository.findOne({
      _id: productId,
      userId,
      isActive: true
    }, session);
    
    if (!product) {
        throw new AppError('Product not found', 404);
    }
    
    const variation = product.variations.find(v => v._id.toString() === variationId.toString());
    
    if (!variation) {
       throw new AppError('Variation not found for this product', 404);
    }
    
    const effectivePrice = lineTotal ? this.calculateEffectivePrice(lineTotal, quantity) : pricePerUnit;
    
  
    const costPricePerVariation = product.costPricePerBaseUnit ? product.costPricePerBaseUnit * variation.conversionToBase : 0;
    // Cost null = first purchase not done yet — allow any price
    
    const pricingWarnings = this.validatePricing(
      effectivePrice,
      costPricePerVariation,
      variation.minSellingPrice,
      product.productName,
      variation.variationName
    );
    
    const stockWarnings = this.checkStockAvailability(product, variation, quantity);
    
    const stockToDeduct = this.convertToBaseUnit(quantity, variation.conversionToBase);
    
    const actualLineTotal = lineTotal || (quantity * pricePerUnit);
    
    return {
      product,
      variation,
      effectivePrice,
      stockToDeduct,
      actualLineTotal,
      warnings: [...pricingWarnings, ...stockWarnings],
      billItem: {
        isTemporary: false,
        productId: product._id,
        variationId: variation._id,
        variationName: variation.variationName,
        productName: product.productName,
        quantity,
        pricePerUnit,
        effectivePricePerUnit: effectivePrice,
        lineTotal: actualLineTotal
      }
    };
  }
  
  async deductStock(product, stockToDeduct, session) {
    product.currentStock -= stockToDeduct;
    await productRepository.save(product, session);
  }
  
  async createBill(billData, userId) {
    const session = await mongoose.startSession();
  
    return await session.withTransaction(async () => {

      const { billDate, customerName, items, discount = 0 } = billData;

      if (discount > 0) {
        throw new AppError('Discount cannot be positive', 400);
      }
  
      if (!items || items.length === 0) {
        throw new AppError('At least one item is required', 400);
      }
  
      // Validate all items first, no DB writes
      const validatedItems = [];
      let allWarnings = [];
      let totalCost = 0;
  
      for (const item of items) {
        if (item.productId) {
          const processed = await this.processExistingProductItem(item, userId, session);
          validatedItems.push({ type: 'existing', processed });
          allWarnings.push(...processed.warnings);
          const itemCost = (processed.product.costPricePerBaseUnit || 0) * processed.stockToDeduct;
          totalCost += itemCost;
        } else if (item.isTemporary) {
          const processed = this.processTemporaryProductItem(item);
          validatedItems.push({ type: 'temp', processed });
        } else {
          throw new AppError('Item must have either productId or isTemporary flag', 400);
        }
      }
  
      const processedItems = validatedItems.map(v => v.processed.billItem);
      const subTotal = processedItems.reduce((sum, item) => sum + item.lineTotal, 0);
      const finalTotal = subTotal + discount;
  
      if (finalTotal <= 0) {
        throw new AppError('Final total must be greater than zero', 400);
      }
  
      if (finalTotal < totalCost) {
        throw new AppError(`Total amount (₹${finalTotal.toFixed(2)}) is below cost (₹${totalCost.toFixed(2)})`, 400 );
      }
  
      //All valid, now execute DB writes

      // Same product ke saare deductions aggregate karo
      const stockDeductions = new Map();

      for (const { type, processed } of validatedItems) {
        if (type === 'existing') {
          const productId = processed.product._id.toString();
          
          if (stockDeductions.has(productId)) {
            stockDeductions.get(productId).totalDeduction += processed.stockToDeduct;
          } else {
            stockDeductions.set(productId, {
              product: processed.product,
              totalDeduction: processed.stockToDeduct
            });
          }
        }
      }

      // Ek baar deduct karo per product
      for (const [, { product, totalDeduction }] of stockDeductions) {
        await this.deductStock(product, totalDeduction, session);
      }

      const stockUpdates = [];
  
      for (const { type, processed } of validatedItems) {
        if (type === 'existing') {
          stockUpdates.push({
            productId: processed.product._id,
            productName: processed.product.productName,
            variationName: processed.variation.variationName,
            quantitySold: processed.billItem.quantity,
            stockDeducted: processed.stockToDeduct,
            newStock: processed.product.currentStock,
            warnings: processed.warnings
          });
        }
      }
  
      
      const bill = await billRepository.create({
        userId,
        billDate: billDate || new Date(),
        customerName: customerName || null,
        items: processedItems,
        subTotal,
        discount,
        finalTotal
      }, session);

      await temporaryProductService.updateAfterBill(bill, userId, session);

      return {
        bill,
        stockUpdates,
        warnings: allWarnings
      };
    }).finally(() => session.endSession());
  }

  async getBills(query, userId) {
    const {
      startDate,
      endDate,
      customerName,
      page = 1,
      limit = 20
    } = query;
    
   
    let filter = { userId };
    
    if (startDate || endDate) {
      filter.billDate = {};
      
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        filter.billDate.$gte = start;
      }
      
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filter.billDate.$lte = end;
      }
    }
     
    if (customerName) {
      const escapedName = customerName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.customerName = { $regex: escapedName, $options: 'i' };
    }
    
    const skip = (page - 1) * limit;

    const options = {
      skip,
      limit: parseInt(limit),
      sort: { billDate: -1, createdAt: -1 },
      select: 'billNumber billDate customerName finalTotal items createdAt'
    }
    
    const [bills, total] = await Promise.all([
      billRepository.findAll(filter, options),
      billRepository.countDocuments(filter)
    ]);
    
    
    const formattedBills = bills.map(bill => ({
      billId: bill._id,
      billNumber: bill.billNumber,
      billDate: bill.billDate,
      customerName: bill.customerName || 'Walk-in',
      finalTotal: bill.finalTotal,
      itemsCount: bill.items.length,
      createdAt: bill.createdAt
    }));
    
    return {
      bills: formattedBills,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        total
      }
    };
  }
  
  async getBillById(billId, userId) {
    const bill = await billRepository.findOne({ _id: billId, userId });
      if (!bill) {
        throw new AppError('Bill not found', 404);
      }
    
    return {
      billId: bill._id,
      billNumber: bill.billNumber,
      billDate: bill.billDate,
      customerName: bill.customerName || 'Walk-in',
      items: bill.items.map(item => ({
        productName: item.productName,
        variationName: item.variationName,
        quantity: item.quantity,
        pricePerUnit: item.pricePerUnit,
        effectivePricePerUnit: item.effectivePricePerUnit,
        lineTotal: item.lineTotal,
        isTemporary: item.isTemporary
      })),
      subTotal: bill.subTotal,
      discount: bill.discount,
      finalTotal: bill.finalTotal,
      createdAt: bill.createdAt
    };
  }
  
}

module.exports = new BillService();