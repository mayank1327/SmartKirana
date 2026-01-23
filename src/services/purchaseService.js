const mongoose = require('mongoose');
const purchaseRepository = require('../repositories/purchaseRepository');
const productRepository = require('../repositories/productRepository');

class PurchaseService {
  
  // ==================== HELPER METHODS ====================
  
  // Convert quantity to base unit
  convertToBaseUnit(quantity, conversionToBase) {
    return quantity * conversionToBase;
  }
  
  // Convert cost to base unit
  convertCostToBaseUnit(cost, conversionToBase) {
    return cost / conversionToBase;
  }
  
  // Check if cost price changed
  hasCostPriceChanged(oldCost, newCost) {
    if (!oldCost) return true;  // First purchase
    return Math.abs(oldCost - newCost) > 0.01;  // Allow 1 paisa tolerance
  }
  
  // Calculate new MSPs based on new cost
  calculateNewMSPs(variations, newCostPerBaseUnit, oldCostPerBaseUnit) {
    return variations.map(variation => {
      const currentMSP = variation.minSellingPrice;
      
      // If no current MSP, derive from new cost (add 20% margin as default)
      if (!currentMSP || currentMSP === 0) {
        const derivedMSP = newCostPerBaseUnit * variation.conversionToBase * 1.2;
        return {
          variationId: variation._id,
          variationName: variation.variationName,
          oldCost: oldCostPerBaseUnit ? oldCostPerBaseUnit * variation.conversionToBase : 0,
          newCost: newCostPerBaseUnit * variation.conversionToBase,
          currentMSP: null,
          suggestedMSP: Math.round(derivedMSP * 100) / 100,
          status: 'no_msp'
        };
      }
      
      // Calculate cost for this variation
      const oldCostForVariation = oldCostPerBaseUnit ? oldCostPerBaseUnit * variation.conversionToBase : 0;
      const newCostForVariation = newCostPerBaseUnit * variation.conversionToBase;
      
      // Check if MSP is below new cost
      const isBelowCost = currentMSP < newCostForVariation;
      
      // Suggest new MSP (maintain same margin %)
      let suggestedMSP;
      if (oldCostForVariation > 0) {
        const currentMargin = (currentMSP - oldCostForVariation) / oldCostForVariation;
        suggestedMSP = newCostForVariation * (1 + currentMargin);
      } else {
        suggestedMSP = newCostForVariation * 1.2;  // 20% default margin
      }
      
      return {
        variationId: variation._id,
        variationName: variation.variationName,
        oldCost: oldCostForVariation,
        newCost: newCostForVariation,
        currentMSP,
        suggestedMSP: Math.round(suggestedMSP * 100) / 100,
        status: isBelowCost ? 'below_cost' : 'ok'
      };
    });
  }
  
  // Format stock display for response
  formatStockDisplay(product) {
    const { currentStock, variations } = product;
    const sorted = [...variations].sort((a, b) => b.conversionToBase - a.conversionToBase);
    
    const display = sorted.map(variation => {
      const quantity = Math.floor(currentStock / variation.conversionToBase);
      return `${quantity} ${variation.variationName}`;
    });
    
    return display.join(' | ');
  }
  
  // ==================== ITEM PROCESSING ====================
  
  // Process purchase item
  async processPurchaseItem(item, userId, session) {
    const { productId, variationId, quantity, costPricePerUnit } = item;
    
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
  
  // ==================== STOCK & COST UPDATE ====================
  
  // Add stock to product
  async addStock(product, stockToAdd, session) {
    product.currentStock += stockToAdd;
    product.lastPurchaseDate = new Date();
    await productRepository.save(product, session);
  }
  
  // Update cost price
  async updateCostPrice(product, newCostPerBaseUnit, session) {
    product.costPricePerBaseUnit = newCostPerBaseUnit;
    await productRepository.save(product, session);
  }
  
  // Update MSP for variations
  async updateVariationMSPs(product, mspUpdates, session) {
    for (const update of mspUpdates) {
      const variation = product.variations.find(v => v._id.toString() === update.variationId.toString());
      if (variation) {
        variation.minSellingPrice = update.newMSP;
      }
    }
    await productRepository.save(product, session);
  }
  
  // ==================== MAIN PURCHASE CREATION ====================
  
  // Create new purchase
  async createPurchase(purchaseData, userId) {
    const session = await mongoose.startSession();
    
    return await session.withTransaction(async () => {
      const { 
        purchaseDate, 
        supplierName, 
        supplierBillNumber, 
        notes, 
        items,
        costPriceChanges = []  // MSP updates if cost changed
      } = purchaseData;
      
      // Validation: At least one item
      if (!items || items.length === 0) {
        const error = new Error('At least one item is required in the purchase');
        error.status = 400;
        throw error;
      }
      
      // Validation: Purchase date not in future
      if (purchaseDate && new Date(purchaseDate) > new Date()) {
        const error = new Error('Purchase date cannot be in the future');
        error.status = 400;
        throw error;
      }
      
      // Process all items
      const processedItems = [];
      const stockUpdates = [];
      const costPriceUpdates = [];
      
      for (const item of items) {
        const processed = await this.processPurchaseItem(item, userId, session);
        
        processedItems.push(processed.purchaseItem);
        
        // Check if cost price changed
        const costChanged = this.hasCostPriceChanged(
          processed.product.costPricePerBaseUnit,
          processed.newCostPerBaseUnit
        );
        
        if (costChanged) {
          // Calculate suggested MSPs
          const mspSuggestions = this.calculateNewMSPs(
            processed.product.variations,
            processed.newCostPerBaseUnit,
            processed.product.costPricePerBaseUnit
          );
          
          // Check if any MSP is below new cost
          const hasProblematicMSP = mspSuggestions.some(s => s.status === 'below_cost');
          
          if (hasProblematicMSP) {
            // Find if user provided MSP updates for this product
            const userMSPUpdate = costPriceChanges.find(
              c => c.productId.toString() === processed.product._id.toString()
            );
            
            if (!userMSPUpdate) {
              // User must review MSPs
              const error = new Error(
                `Cost price increased for ${processed.product.productName}. ` +
                `Some selling prices are below new cost. Please review and update MSPs.`
              );
              error.status = 400;
              error.code = 'MSP_REVIEW_REQUIRED';
              error.details = {
                productId: processed.product._id,
                productName: processed.product.productName,
                mspSuggestions
              };
              throw error;
            }
            
            // Validate user-provided MSPs
            for (const varUpdate of userMSPUpdate.variations) {
              const suggestion = mspSuggestions.find(
                s => s.variationId.toString() === varUpdate.variationId.toString()
              );
              
              if (varUpdate.newMinSellingPrice < suggestion.newCost) {
                const error = new Error(
                  `Cannot set MSP (₹${varUpdate.newMinSellingPrice}) below cost (₹${suggestion.newCost}) ` +
                  `for ${suggestion.variationName}`
                );
                error.status = 400;
                error.code = 'MSP_BELOW_COST';
                throw error;
              }
            }
            
            // Update MSPs
            await this.updateVariationMSPs(
              processed.product,
              userMSPUpdate.variations.map(v => ({
                variationId: v.variationId,
                newMSP: v.newMinSellingPrice
              })),
              session
            );
          }
          
          costPriceUpdates.push({
            productId: processed.product._id,
            productName: processed.product.productName,
            oldCost: processed.product.costPricePerBaseUnit,
            newCost: processed.newCostPerBaseUnit,
            mspUpdated: hasProblematicMSP
          });
        }
        
        // Update cost price
        await this.updateCostPrice(processed.product, processed.newCostPerBaseUnit, session);
        
        // Add stock
        await this.addStock(processed.product, processed.stockToAdd, session);
        
        // Refresh product for display
        const updatedProduct = await productRepository.findById(processed.product._id, session);
        
        stockUpdates.push({
          productId: updatedProduct._id,
          productName: updatedProduct.productName,
          variationName: processed.variation.variationName,
          quantityPurchased: item.quantity,
          stockAdded: processed.stockToAdd,
          stockBefore: processed.stockBefore,
          stockAfter: updatedProduct.currentStock,
          stockDisplay: this.formatStockDisplay(updatedProduct)
        });
      }
      
      // Calculate total amount
      const totalAmount = processedItems.reduce((sum, item) => sum + item.lineTotal, 0);
      
      // Create purchase document
      const purchase = await purchaseRepository.create({
        userId,
        purchaseDate: purchaseDate || new Date(),
        supplierName: supplierName || null,
        supplierBillNumber: supplierBillNumber || null,
        notes: notes || null,
        items: processedItems,
        totalAmount
      }, session);
      
      return {
        purchase,
        stockUpdates,
        costPriceUpdates
      };
    }).finally(() => session.endSession());
  }
  
  // ==================== QUERY METHODS ====================
  
  // Get all purchases with filters
  async getPurchases(query, userId) {
    const {
      startDate,
      endDate,
      supplierName,
      productName,
      page = 1,
      limit = 20
    } = query;
    
    // Build filter
    let filter = { userId };
    
    // Date range filter
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
    
    // Supplier name filter
    if (supplierName) {
      filter.supplierName = { $regex: supplierName, $options: 'i' };
    }
    
    // Product name filter (search in items array)
    if (productName) {
      filter['items.productName'] = { $regex: productName, $options: 'i' };
    }
    
    // Pagination
    const skip = (page - 1) * limit;
    
    const purchases = await purchaseRepository.findPurchases(filter, {
      skip,
      limit: parseInt(limit),
      sort: { purchaseDate: -1, createdAt: -1 },
      select: 'purchaseNumber purchaseDate supplierName totalAmount items createdAt'
    });
    
    const total = await purchaseRepository.countDocuments(filter);
    
    // Format purchases
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
  
  // Get single purchase by ID
  async getPurchaseById(purchaseId, userId) {
    const purchase = await purchaseRepository.findById(purchaseId);
    
    if (!purchase) {
      const error = new Error('Purchase not found');
      error.status = 404;
      throw error;
    }
    
    // Check ownership
    if (purchase.userId.toString() !== userId.toString()) {
      const error = new Error('Unauthorized access to this purchase');
      error.status = 403;
      throw error;
    }
    
    return {
      purchaseId: purchase._id,
      purchaseNumber: purchase.purchaseNumber,
      purchaseDate: purchase.purchaseDate,
      supplierName: purchase.supplierName,
      supplierBillNumber: purchase.supplierBillNumber,
      notes: purchase.notes,
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
  
  // Get today's purchases
  async getTodaysPurchases(userId) {
    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const endOfDay = new Date(today.setHours(23, 59, 59, 999));
    
    const purchases = await this.getPurchases({
      startDate: startOfDay.toISOString(),
      endDate: endOfDay.toISOString(),
      limit: 100
    }, userId);
    
    // Calculate summary
    const summary = {
      totalPurchases: purchases.purchases.length,
      totalAmount: purchases.purchases.reduce((sum, p) => sum + p.totalAmount, 0)
    };
    
    return {
      date: today.toISOString().split('T')[0],
      summary,
      purchases: purchases.purchases
    };
  }
}

module.exports = new PurchaseService();