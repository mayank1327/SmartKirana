const mongoose = require('mongoose');
const billRepository = require('../repositories/billRepository');
const productRepository = require('../repositories/productRepository');
const temporaryProductRepository = require('../repositories/TemporaryProductRepository');

class BillService {
  
  // ==================== VALIDATION HELPERS ====================
  
  // Validate pricing against cost and MSP
  validatePricing(price, costPrice, msp, productName, variationName) {
    const warnings = [];
    
    // Block if price < cost
    if (price < costPrice) {
      const error = new Error(
        `Cannot sell ${productName} (${variationName}) at ₹${price}. Cost price is ₹${costPrice}`
      );
      error.status = 400;
      error.code = 'PRICE_BELOW_COST';
      throw error;
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
  
  // Calculate effective price after line total adjustment
  calculateEffectivePrice(lineTotal, quantity) {
    return lineTotal / quantity;
  }
  
  // Convert quantity to base unit
  convertToBaseUnit(quantity, conversionToBase) {
    return quantity * conversionToBase;
  }
  
  // Check stock availability (non-blocking warning)
  checkStockAvailability(product, variation, quantity) {
    const warnings = [];
    
    // Calculate required stock in base unit
    const requiredStock = this.convertToBaseUnit(quantity, variation.conversionToBase);
    
    // Check if sufficient
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
  
  // ==================== ITEM PROCESSING ====================
  
  // Process existing product item
  async processExistingProductItem(item, userId, session) {
    const { productId, variationId, quantity, pricePerUnit, lineTotal } = item;
    
    // Fetch product
    const product = await productRepository.findById(productId, session);
    
    if (!product) {
      const error = new Error('Product not found');
      error.status = 404;
      throw error;
    }
    
    // Check ownership
    if (product.userId.toString() !== userId.toString()) {
      const error = new Error('Unauthorized access to this product');
      error.status = 403;
      throw error;
    }
    
    // Check if active
    if (!product.isActive) {
      const error = new Error('Product is not active');
      error.status = 400;
      throw error;
    }
    
    // Find variation
    const variation = product.variations.find(v => v._id.toString() === variationId.toString());
    
    if (!variation) {
      const error = new Error('Variation not found for this product');
      error.status = 404;
      throw error;
    }
    
    // Calculate effective price (if line total was adjusted)
    const effectivePrice = lineTotal ? this.calculateEffectivePrice(lineTotal, quantity) : pricePerUnit;
    
    // Get cost price for this variation
    const costPricePerVariation = product.costPricePerBaseUnit 
      ? product.costPricePerBaseUnit * variation.conversionToBase 
      : 0;
    
    // Validate pricing
    const pricingWarnings = this.validatePricing(
      effectivePrice,
      costPricePerVariation,
      variation.minSellingPrice,
      product.productName,
      variation.variationName
    );
    
    // Check stock availability (non-blocking)
    const stockWarnings = this.checkStockAvailability(product, variation, quantity);
    
    // Calculate stock to deduct
    const stockToDeduct = this.convertToBaseUnit(quantity, variation.conversionToBase);
    
    // Calculate actual line total
    const actualLineTotal = lineTotal || (quantity * pricePerUnit);
    
    return {
      product,
      variation,
      effectivePrice,
      stockToDeduct,
      actualLineTotal,
      warnings: [...pricingWarnings, ...stockWarnings],
      billItem: {
        productId: product._id,
        productName: product.productName,
        variationId: variation._id,
        variationName: variation.variationName,
        tempProductName: null,
        quantity,
        pricePerUnit,
        effectivePricePerUnit: effectivePrice,
        lineTotal: actualLineTotal
      }
    };
  }
  
  // Process temporary product item (Quick Add)
  processTemporaryProductItem(item) {
    const { tempProductName, quantity, pricePerUnit, lineTotal } = item;
    
    // Calculate effective price
    const effectivePrice = lineTotal ? this.calculateEffectivePrice(lineTotal, quantity) : pricePerUnit;
    
    // Calculate actual line total
    const actualLineTotal = lineTotal || (quantity * pricePerUnit);
    
    return {
      effectivePrice,
      actualLineTotal,
      warnings: [],
      billItem: {
        productId: null,
        productName: tempProductName,
        variationId: null,
        variationName: null,
        tempProductName,
        quantity,
        pricePerUnit,
        effectivePricePerUnit: effectivePrice,
        lineTotal: actualLineTotal
      }
    };
  }
  
  // ==================== STOCK DEDUCTION ====================
  
  // Deduct stock for product
  async deductStock(product, stockToDeduct, session) {
    product.currentStock -= stockToDeduct;
    product.lastSaleDate = new Date();
    await productRepository.save(product, session);
  }
  
  // ==================== TEMPORARY PRODUCTS ====================
  
  // Update temporary products after bill created
  async updateTemporaryProducts(bill, userId, session) {
    // Find all temporary items in bill
    const tempItems = bill.items.filter(item => item.tempProductName);
    
    if (tempItems.length === 0) {
      return 0;
    }
    
    // Group by product name and aggregate
    const aggregated = {};
    
    tempItems.forEach(item => {
      const name = item.tempProductName.toLowerCase();
      
      if (!aggregated[name]) {
        aggregated[name] = {
          productName: item.tempProductName,
          totalQuantity: 0,
          totalRevenue: 0
        };
      }
      
      aggregated[name].totalQuantity += item.quantity;
      aggregated[name].totalRevenue += item.lineTotal;
    });
    
    // Update or create temporary product records
    for (const [key, data] of Object.entries(aggregated)) {
      // Find existing temporary product
      let tempProduct = await temporaryProductRepository.findOne({
        userId,
        productName: { $regex: new RegExp(`^${data.productName}$`, 'i') }
      }, session);
      
      if (tempProduct) {
        // Update existing
        tempProduct.billIds.push(bill._id);
        tempProduct.totalQuantitySold += data.totalQuantity;
        tempProduct.totalRevenue += data.totalRevenue;
        tempProduct.lastSoldDate = bill.billDate;
        
        await temporaryProductRepository.save(tempProduct, session);
      } else {
        // Create new
        await temporaryProductRepository.create({
          userId,
          productName: data.productName,
          firstBillId: bill._id,
          billIds: [bill._id],
          totalQuantitySold: data.totalQuantity,
          totalRevenue: data.totalRevenue,
          lastSoldDate: bill.billDate,
          isPendingSetup: true
        }, session);
      }
    }
    
    return Object.keys(aggregated).length;
  }
  
  // ==================== MAIN BILL CREATION ====================
  
  // Create new bill
  async createBill(billData, userId) {
    const session = await mongoose.startSession();
    
    return await session.withTransaction(async () => {
      const { billDate, customerName, items, discount = 0 } = billData;
      
      // Validation: At least one item
      if (!items || items.length === 0) {
        const error = new Error('At least one item is required in the bill');
        error.status = 400;
        throw error;
      }
      
      // Validation: Bill date not in future
      if (billDate && new Date(billDate) > new Date()) {
        const error = new Error('Bill date cannot be in the future');
        error.status = 400;
        throw error;
      }
      
      // Process all items
      const processedItems = [];
      const stockUpdates = [];
      let allWarnings = [];
      let totalCost = 0;  // Track total cost for validation
      
      for (const item of items) {
        if (item.productId) {
          // Existing product
          const processed = await this.processExistingProductItem(item, userId, session);
          
          processedItems.push(processed.billItem);
          allWarnings.push(...processed.warnings);
          
          // Track cost
          const itemCost = (processed.product.costPricePerBaseUnit || 0) * processed.stockToDeduct;
          totalCost += itemCost;
          
          // Deduct stock
          await this.deductStock(processed.product, processed.stockToDeduct, session);
          
          // Add to stock updates response
          stockUpdates.push({
            productId: processed.product._id,
            productName: processed.product.productName,
            variationName: processed.variation.variationName,
            quantitySold: item.quantity,
            stockDeducted: processed.stockToDeduct,
            newStock: processed.product.currentStock,
            warnings: processed.warnings
          });
        } else if (item.tempProductName) {
          // Temporary product (Quick Add)
          const processed = this.processTemporaryProductItem(item);
          processedItems.push(processed.billItem);
          // No cost tracking for temporary products
        } else {
          const error = new Error('Item must have either productId or tempProductName');
          error.status = 400;
          throw error;
        }
      }
      
      // Calculate sub total
      const subTotal = processedItems.reduce((sum, item) => sum + item.lineTotal, 0);
      
      // Calculate final total
      const finalTotal = subTotal + discount;  // discount can be negative
      
      // Validation: Final total must be > 0
      if (finalTotal <= 0) {
        const error = new Error('Final total must be greater than zero');
        error.status = 400;
        throw error;
      }
      
      // Validation: Final total must be >= total cost (for existing products)
      if (finalTotal < totalCost) {
        const error = new Error(
          `Total amount (₹${finalTotal.toFixed(2)}) is below cost (₹${totalCost.toFixed(2)}). ` +
          `Reduce discount or increase prices.`
        );
        error.status = 400;
        error.code = 'TOTAL_BELOW_COST';
        throw error;
      }
      
      // Create bill document
      const bill = await billRepository.create({
        userId,
        billDate: billDate || new Date(),
        customerName: customerName || null,
        items: processedItems,
        subTotal,
        discount,
        finalTotal
      }, session);
      
      // Update temporary products
      const tempProductsCount = await this.updateTemporaryProducts(bill, userId, session);
      
      return {
        bill,
        stockUpdates,
        warnings: allWarnings,
        tempProductsCount
      };
    }).finally(() => session.endSession());
  }
  
  // ==================== QUERY METHODS ====================
  
  // Get all bills with filters
  async getBills(query, userId) {
    const {
      startDate,
      endDate,
      customerName,
      page = 1,
      limit = 20
    } = query;
    
    // Build filter
    let filter = { userId };
    
    // Date range filter
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
    
    // Customer name filter (case-insensitive partial match)
    if (customerName) {
      filter.customerName = { $regex: customerName, $options: 'i' };
    }
    
    // Pagination
    const skip = (page - 1) * limit;
    
    const bills = await billRepository.findBills(filter, {
      skip,
      limit: parseInt(limit),
      sort: { billDate: -1, createdAt: -1 },
      select: 'billNumber billDate customerName finalTotal items createdAt'
    });
    
    const total = await billRepository.countDocuments(filter);
    
    // Format bills
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
        pages: Math.ceil(total / limit),
        total
      }
    };
  }
  
  // Get single bill by ID
  async getBillById(billId, userId) {
    const bill = await billRepository.findById(billId);
    
    if (!bill) {
      const error = new Error('Bill not found');
      error.status = 404;
      throw error;
    }
    
    // Check ownership
    if (bill.userId.toString() !== userId.toString()) {
      const error = new Error('Unauthorized access to this bill');
      error.status = 403;
      throw error;
    }
    
    return {
      billId: bill._id,
      billNumber: bill.billNumber,
      billDate: bill.billDate,
      customerName: bill.customerName,
      items: bill.items.map(item => ({
        productName: item.productName,
        variationName: item.variationName,
        quantity: item.quantity,
        pricePerUnit: item.pricePerUnit,
        effectivePricePerUnit: item.effectivePricePerUnit,
        lineTotal: item.lineTotal,
        isTemporary: !!item.tempProductName
      })),
      subTotal: bill.subTotal,
      discount: bill.discount,
      finalTotal: bill.finalTotal,
      createdAt: bill.createdAt
    };
  }
  
  // Get today's bills
  async getTodaysBills(userId) {
    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const endOfDay = new Date(today.setHours(23, 59, 59, 999));
    
    const bills = await this.getBills({
      startDate: startOfDay.toISOString(),
      endDate: endOfDay.toISOString(),
      limit: 100
    }, userId);
    
    // Calculate summary
    const summary = {
      totalBills: bills.bills.length,
      totalRevenue: bills.bills.reduce((sum, bill) => sum + bill.finalTotal, 0)
    };
    
    return {
      date: today.toISOString().split('T')[0],
      summary,
      bills: bills.bills
    };
  }
  
  // ==================== TEMPORARY PRODUCTS MANAGEMENT ====================
  
  // Get all temporary products
  async getTemporaryProducts(userId) {
    const tempProducts = await temporaryProductRepository.find(
      { 
        userId,
        isPendingSetup: true 
      },
      { 
        sort: { lastSoldDate: -1 }
      }
    );
    
    return tempProducts.map(tp => ({
      tempProductId: tp._id,
      productName: tp.productName,
      totalQuantitySold: tp.totalQuantitySold,
      totalRevenue: tp.totalRevenue,
      billsCount: tp.billIds.length,
      lastSoldDate: tp.lastSoldDate,
      isPendingSetup: tp.isPendingSetup
    }));
  }
  
  // Complete setup for temporary product (convert to full product)
  async completeTemporaryProductSetup(tempProductId, productData, userId) {
    const session = await mongoose.startSession();
    
    return await session.withTransaction(async () => {
      // Find temporary product
      const tempProduct = await temporaryProductRepository.findById(tempProductId, session);
      
      if (!tempProduct) {
        const error = new Error('Temporary product not found');
        error.status = 404;
        throw error;
      }
      
      // Check ownership
      if (tempProduct.userId.toString() !== userId.toString()) {
        const error = new Error('Unauthorized access');
        error.status = 403;
        throw error;
      }
      
      // Check if already completed
      if (!tempProduct.isPendingSetup) {
        const error = new Error('This product has already been set up');
        error.status = 400;
        throw error;
      }
      
      // Import product service to create full product
      const productService = require('./productService');
      
      // Create full product (reuse productData structure)
      const newProduct = await productService.createProduct(productData, userId);
      
      // Update temporary product record
      tempProduct.isPendingSetup = false;
      tempProduct.convertedProductId = newProduct._id;
      tempProduct.setupCompletedAt = new Date();
      await temporaryProductRepository.save(tempProduct, session);
      
      return {
        productId: newProduct._id,
        productName: newProduct.productName,
        linkedBillsCount: tempProduct.billIds.length
      };
    }).finally(() => session.endSession());
  }
  
  // Delete temporary product
  async deleteTemporaryProduct(tempProductId, userId) {
    // Find temporary product
    const tempProduct = await temporaryProductRepository.findById(tempProductId);
    
    if (!tempProduct) {
      const error = new Error('Temporary product not found');
      error.status = 404;
      throw error;
    }
    
    // Check ownership
    if (tempProduct.userId.toString() !== userId.toString()) {
      const error = new Error('Unauthorized access');
      error.status = 403;
      throw error;
    }
    
    // Delete
    await temporaryProductRepository.deleteById(tempProductId);
    
    return {
      message: 'Temporary product deleted successfully',
      productName: tempProduct.productName,
      billsCount: tempProduct.billIds.length
    };
  }
}

module.exports = new BillService();