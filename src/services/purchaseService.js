const mongoose = require('mongoose');
const purchaseRepository = require('../repositories/purchaseRepository');
const productRepository = require('../repositories/productRepository');
const { formatStockDisplay } = require('../utils/stockUtils');
const AppError = require('../utils/AppError');

class PurchaseService {

  convertToBaseUnit(quantity, conversionToBase) {
    return quantity * conversionToBase;
  }
  
  convertCostToBaseUnit(cost, conversionToBase) {
    return Math.round(cost / conversionToBase);
  }
  
  hasCostPriceChanged(oldCost, newCost) {
    if (!oldCost) return true;  // First purchase
    return oldCost !== newCost; // Exact comparison — dono integers hain
  }

  validateMSPs(variations, newCostPerBaseUnit, mspUpdates) {
    // Saari variations ka MSP required
    if (!mspUpdates || mspUpdates.length !== variations.length) {
      throw new AppError(
        `MSP required for all ${variations.length} variations when cost price changes`,
        400
      );
    }
  
    return mspUpdates.map(update => {
      const variation = variations.find(
        v => v._id.toString() === update.variationId.toString()
      );
  
      if (!variation) {
        throw new AppError(`Invalid variation ID: ${update.variationId}`, 404);
      }
  
      if (!update.newMinSellingPrice) {
        throw new AppError(
          `MSP cannot be null for ${variation.variationName}`, 400
        );
      }
  
      const newCost = Math.round(newCostPerBaseUnit * variation.conversionToBase);
  
      if (update.newMinSellingPrice < newCost) {
        throw new AppError(
          `MSP for ${variation.variationName} (₹${update.newMinSellingPrice}) is below cost (₹${newCost})`,
          400
        );
      }
  
      return {
        variationId: variation._id,
        variationName: variation.variationName,
        newMSP: update.newMinSellingPrice
      };
    });
  }
  
  async processPurchaseItem(item, userId, session) {
    const { productId, variationId, quantity, costPricePerUnit } = item;
    
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
      throw new AppError('Variation not found for this product', 400);
    }
    
    // Calculate stock to add (in base unit)
    const stockToAdd = this.convertToBaseUnit(quantity, variation.conversionToBase);
    
    // Calculate new cost price per base unit
    const newCostPerBaseUnit = this.convertCostToBaseUnit(costPricePerUnit, variation.conversionToBase);
    
    // Track stock before
    const stockBefore = product.currentStock;
    
    // Calculate line total
    const lineTotal = quantity * costPricePerUnit;
    
    return {
      product,
      variation,
      stockToAdd,
      newCostPerBaseUnit,
      stockBefore,
      lineTotal,
      purchaseItem: {
        productId: product._id,
        productName: product.productName,
        variationId: variation._id,
        variationName: variation.variationName,
        quantity,
        costPricePerUnit,
        lineTotal,
        stockBefore,
        stockAfter: stockBefore + stockToAdd
      }
    };
  }

  async updateProductAfterPurchase(product, newCostPerBaseUnit, stockToAdd, mspUpdates, session) {
    // Cost price update
    product.costPricePerBaseUnit = newCostPerBaseUnit;
  
    // Stock update
    product.currentStock += stockToAdd;
  
    // MSP update agar hai
    if (mspUpdates) {
      for (const update of mspUpdates) {
        const variation = product.variations.find(
          v => v._id.toString() === update.variationId.toString()
        );
        if (variation) {
          variation.minSellingPrice = update.newMSP;
        }
      }
    }
  
    // Ek baar save
    await productRepository.save(product, session);
  }
  
  async createPurchase(purchaseData, userId) {
    const session = await mongoose.startSession();
  
    return await session.withTransaction(async () => {

      const { purchaseDate, supplierName, items } = purchaseData;
  
      // Fast fail validations
      if (!items || items.length === 0) {
        throw new AppError('At least one purchase item is required', 400);
      }
  
      if (purchaseDate && new Date(purchaseDate) > new Date()) {
        throw new AppError('Purchase date cannot be in the future', 400);
      }

      const productIds = items.map(i => i.productId.toString());
      const uniqueIds = new Set(productIds);

      if (productIds.length !== uniqueIds.size) {
        throw new AppError('Same product cannot appear multiple times in one purchase', 400);
      }
  
      // Phase 1 — Validate all items, no DB writes
      const processedItems = [];
      const costPriceUpdates = [];
  
      for (const item of items) {
        const processed = await this.processPurchaseItem(item, userId, session);
        processedItems.push(processed);
  
        // Cost price changed?
        const costChanged = this.hasCostPriceChanged(
          processed.product.costPricePerBaseUnit,
          processed.newCostPerBaseUnit
        );

        if (costChanged) {
          processed.updatedMSPs = this.validateMSPs(
            processed.product.variations,
            processed.newCostPerBaseUnit,
            item.mspUpdates
          );
        
          costPriceUpdates.push({
            productId: processed.product._id,
            productName: processed.product.productName,
            oldCost: processed.product.costPricePerBaseUnit,
            newCost: processed.newCostPerBaseUnit,
            mspUpdated: true
          });
        }
      }
  
     // Phase 2 — All valid, DB writes
      for (const processed of processedItems) {
        await this.updateProductAfterPurchase(
          processed.product,
          processed.newCostPerBaseUnit,
          processed.stockToAdd,
          processed.updatedMSPs || null,
          session
        );
      }

      // Purchase document create karo
      const totalAmount = processedItems.reduce(
        (sum, p) => sum + p.purchaseItem.lineTotal, 0
      );

      const purchase = await purchaseRepository.create({
        userId,
        purchaseDate: purchaseDate || new Date(),
        supplierName: supplierName || null,
        items: processedItems.map(p => p.purchaseItem),
        totalAmount
      }, session);

      return {
        purchase,
        costPriceUpdates,
        stockUpdates: processedItems.map(p => ({
          productId: p.product._id,
          productName: p.product.productName,
          variationName: p.variation.variationName,
          quantityPurchased: p.purchaseItem.quantity,
          stockAdded: p.stockToAdd,
          stockBefore: p.stockBefore,
          stockAfter: p.stockBefore + p.stockToAdd
        }))
      };
    }).finally(() => session.endSession());
  }

  async getPurchases(query, userId) {
    const {
      startDate,
      endDate,
      supplierName,
      productName,
      page = 1,
      limit = 20
    } = query;
    
    let filter = { userId };
    
    if (startDate || endDate) {
      filter.purchaseDate = {};
      
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        filter.purchaseDate.$gte = start;
      }
      
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filter.purchaseDate.$lte = end;
      }
    }
    
    if (supplierName) {
      const escapedSupplier = supplierName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.supplierName = { $regex: escapedSupplier, $options: 'i' };
    }
    
    if (productName) {
      const escapedProduct = productName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter['items.productName'] = { $regex: escapedProduct, $options: 'i' };
    }
    
    const skip = (page - 1) * limit;

    const options = {
      skip,
      limit: parseInt(limit),
      sort: { purchaseDate: -1, createdAt: -1 },
      select: 'purchaseNumber purchaseDate supplierName totalAmount items createdAt'
    }
    
    const [purchases, total] = await Promise.all([
      purchaseRepository.findAll(filter, options),
      purchaseRepository.countDocuments(filter)
    ]);
    const formattedPurchases = purchases.map(purchase => ({
      purchaseId: purchase._id,
      purchaseNumber: purchase.purchaseNumber,
      purchaseDate: purchase.purchaseDate,
      supplierName: purchase.supplierName || 'N/A',
      totalAmount: purchase.totalAmount,
      itemsCount: purchase.items.length,
      products: [...new Set(purchase.items.map(item => item.productName))],  // Unique product names
      createdAt: purchase.createdAt
    }));
    
    return {
      purchases: formattedPurchases,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    };
  }
  
  async getPurchaseById(purchaseId, userId) {
    const purchase = await purchaseRepository.findOne({
      _id: purchaseId,
      userId
    });
    
    if (!purchase) {
      throw new AppError('Purchase not found', 404);
    }
    
    return {
      purchaseId: purchase._id,
      purchaseNumber: purchase.purchaseNumber,
      purchaseDate: purchase.purchaseDate,
      supplierName: purchase.supplierName,
      items: purchase.items.map(item => ({
        productName: item.productName,
        variationName: item.variationName,
        quantity: item.quantity,
        costPricePerUnit: item.costPricePerUnit,
        lineTotal: item.lineTotal,
        stockBefore: item.stockBefore,
        stockAfter: item.stockAfter
      })),
      totalAmount: purchase.totalAmount,
      createdAt: purchase.createdAt
    };
  }
  
}

module.exports = new PurchaseService();