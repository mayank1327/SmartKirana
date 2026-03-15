const mongoose = require('mongoose');
const productRepository = require('../repositories/productRepository');
const { formatStockDisplay } = require('../utils/stockUtils');
const AppError = require('../utils/AppError');

class ProductService {
  
  validateUnits(units) {
    // At least one unit must exist
    if (!units || units.length === 0) {
      throw new AppError('At least one unit is required', 400);
    }

    //Unit names must be unique (case-insensitive)
    const unitNames = units.map(u => u.unitName.toLowerCase());
    const uniqueNames = new Set(unitNames);
    if (unitNames.length !== uniqueNames.size) {
      throw new AppError('Duplicate unit names are not allowed', 400);
    }

    // Exactly one base unit must be selected
    const baseUnits = units.filter(u => u.isBase === true);
    if (baseUnits.length === 0) {
      throw new AppError('Base unit must be selected', 400);
    }
    if (baseUnits.length > 1) {
      throw new AppError('Only one base unit can be selected', 400);
    }
   
    return true;
  }

  validateVariationChain(variations, baseUnitName) {
    // Must have at least one variation
    if (!variations || variations.length === 0) {
      throw new AppError('At least one variation is required', 400);
    }

    // Exactly one variation per unit
    const variationUnits = variations.map(v => v.unitName.toLowerCase());
    const uniqueUnits = new Set(variationUnits);
    if (variationUnits.length !== uniqueUnits.size) {
      throw new AppError('Each unit must have exactly one variation', 400);
    }

    // Base unit variation validation
    const baseVariation = variations.find(v => v.unitName.toLowerCase() === baseUnitName.toLowerCase());
    if (!baseVariation) {
      throw new AppError('Base unit must have a variation', 400);
    }
    
    // Base unit must contain itself × 1
    if (baseVariation.containsQuantity !== 1) {
      throw new AppError('Base unit must contain quantity = 1', 400);
    }
    if (baseVariation.containsUnit?.toLowerCase() !== baseUnitName.toLowerCase()) {
      throw new AppError('Base unit must contain itself', 400);
    }

    // Non-base variations must have valid containsQuantity and containsUnit
    const nonBaseVariations = variations.filter(v => v.unitName.toLowerCase() !== baseUnitName.toLowerCase());
    for (const variation of nonBaseVariations) {
      // Must have containsQuantity
      if (!variation.containsQuantity || variation.containsQuantity <= 0) {
        throw new AppError(`${variation.unitName}: containsQuantity must be greater than 0`, 400);
      }

      // Must have containsUnit
      if (!variation.containsUnit) {
        throw new AppError(`${variation.unitName}: containsUnit is required`, 400);
      }

      // containsUnit must be a valid unit (exists in variations)
      const containsUnitExists = variations.some(v => 
        v.unitName.toLowerCase() === variation.containsUnit.toLowerCase()
      );
      if (!containsUnitExists) {
        throw new AppError(`${variation.unitName}: containsUnit "${variation.containsUnit}" does not exist`, 400);
      }

      // Cannot contain itself (except base unit)
      if (variation.unitName.toLowerCase() === variation.containsUnit.toLowerCase()) {
        throw new AppError(`${variation.unitName}: cannot contain itself`, 400);
      }
    }

    // Check for circular dependencies
    const checkCircular = (startUnit, visited = new Set()) => {
      if (visited.has(startUnit.toLowerCase())) {
        return true; // Found a cycle
      }

      visited.add(startUnit.toLowerCase());

      const variation = variations.find(v => v.unitName.toLowerCase() === startUnit.toLowerCase());
      
      // If it's base unit, no cycle
      if (variation.unitName.toLowerCase() === baseUnitName.toLowerCase()) {
        return false;
      }

      // Check the unit it contains
      return checkCircular(variation.containsUnit, visited);
    };
    for (const variation of nonBaseVariations) {
      if (checkCircular(variation.unitName)) {
       throw new AppError(`Circular dependency detected involving ${variation.unitName}`, 400);
      }
    }

    return true;
  }

  calculateConversionChain(variations, baseUnitName) {
    const conversionMap = new Map();

    // Recursive function to calculate conversion
    const calculateConversion = (unitName) => {
      // If already calculated, return it
      if (conversionMap.has(unitName.toLowerCase())) {
        return conversionMap.get(unitName.toLowerCase());
      }

      // Find the variation
      const variation = variations.find(v => v.unitName.toLowerCase() === unitName.toLowerCase());
      if (!variation) {
        throw new Error(`Variation not found for unit: ${unitName}`);
      }

      // Base unit conversion is 1
      if (variation.unitName.toLowerCase() === baseUnitName.toLowerCase()) {
        conversionMap.set(unitName.toLowerCase(), 1);
        return 1;
      }

      // Calculate recursively
      // conversionToBase = containsQuantity × conversionToBase(containsUnit)
      const containsUnitConversion = calculateConversion(variation.containsUnit);
      const thisConversion = variation.containsQuantity * containsUnitConversion;
      
      conversionMap.set(unitName.toLowerCase(), thisConversion);
      return thisConversion;
    };

    // Calculate for all variations
    for (const variation of variations) {
      calculateConversion(variation.unitName);
    }

    return conversionMap;

  }

  convertMinStockToBase(minStockLevel, conversionMap) {
    
    if (!minStockLevel || minStockLevel.value == null) {
      return null;
    }

    const { value, unit } = minStockLevel;

   
    if (value <= 0) {
      throw new AppError('Minimum stock level must be greater than 0', 400);
    }

    const conversion = conversionMap.get(unit.toLowerCase());
    
    if (!conversion) {
      throw new AppError(`Invalid unit for minimum stock level: ${unit}`, 400);
    }

    const minStockInBase = value * conversion;

    return minStockInBase;
  }

  getStockStatus(product) {

    const { currentStock, minStockLevel } = product;

    // red = out of stock, yellow = low stock, green = sufficient
    if (currentStock <= 0) {
      return 'out_of_stock';
    }

    if (minStockLevel && currentStock <= minStockLevel) {
      return 'low_stock';
    }
    
    return 'sufficient';

  }


  async getAllProducts(query = {}, userId) {
    const { 
      search,          
      lowStock,    
      isActive = true,  
      page = 1, 
      limit = 20 
    } = query;
  
    
    let filter = { 
      userId,
      isActive: isActive === 'true' || isActive === true
    };
  
    if (search) {
      const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.productName = { $regex: escapedSearch, $options: 'i' };
    }
  
    if (lowStock === 'true') {
      filter.$expr = {
        $and: [
          { $ne: ['$minStockLevel', null] },
          { $lte: ['$currentStock', '$minStockLevel'] }
        ]
      };
    }
  
    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: { createdAt: -1 }
    };
  
    const { products, total } = await productRepository.findAll(filter, options);
  

    const formattedProducts = products.map(product => {
      return {
        _id: product._id,
        productName: product.productName,
        stockDisplay: formatStockDisplay(product),
        stockStatus: this.getStockStatus(product),
      };
    });
  
    return {
      products: formattedProducts,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    };
  }

  async getProductById(productId, userId) {
    
    const product = await productRepository.findOne({ 
        _id: productId, 
        userId,
        isActive: true
    });

    if (!product) {
      throw new AppError('Product not found', 404);
    }

    const formatVariation = (variation, units) => {
      const containsUnit = units.find(
        u => u._id.toString() === variation.containsUnitId.toString()
      );
    
      return {
        _id: variation._id,
        variationName: variation.variationName,
        containsQuantity: variation.containsQuantity,
        containsUnitName: containsUnit?.unitName || null,
        conversionToBase: variation.conversionToBase,
        minSellingPrice: variation.minSellingPrice
      };
    };

    return {
      _id: product._id,
      productName: product.productName,
      baseUnit: product.baseUnit,
      units: product.units,
      variations: product.variations.map(v => formatVariation(v, product.units)),
      costPricePerBaseUnit: product.costPricePerBaseUnit,
      currentStock: product.currentStock,
      stockDisplay: formatStockDisplay(product),
      minStockLevel: product.minStockLevel,
      stockStatus: this.getStockStatus(product),
      isActive: product.isActive,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt
    };
  }
 
  async createProduct(productData, userId, session = null) {
    const { productName, units, variations, minStockLevel } = productData;
    
    // DB unique index is case-sensitive — 'Chawal' and 'chawal' would be treated as different
    // Regex with 'i' flag prevents case-insensitive duplicates before hitting DB
    const escapedName = productName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); 
    const existingProduct = await productRepository.findOne({
      productName: { $regex: new RegExp(`^${escapedName}$`, 'i') },
      userId,
      isActive: true
    });
    
    if (existingProduct) {
      throw new AppError('Product with this name already exists', 409);
    }

    this.validateUnits(units);

    const baseUnit = units.find(u => u.isBase === true);
    const baseUnitName = baseUnit.unitName;

    this.validateVariationChain(variations, baseUnitName);

    const conversionMap = this.calculateConversionChain(variations, baseUnitName);
    
    const minStockInBase = this.convertMinStockToBase(minStockLevel, conversionMap);


    // create units with IDs
    const unitsWithIds = units.map(u => ({
      _id: new mongoose.Types.ObjectId(),
      unitName: u.unitName.toLowerCase(),
      isBaseUnit: u.isBase
    }));

    const baseUnitDoc = unitsWithIds.find(u => u.isBaseUnit === true);

    // Build variations with IDs and references
    const variationsWithIds = variations.map(v => {

      const unitDoc = unitsWithIds.find(u => u.unitName === v.unitName.toLowerCase());
      
      const containsUnitDoc = unitsWithIds.find(u => u.unitName === v.containsUnit?.toLowerCase());

      return {
        _id: new mongoose.Types.ObjectId(),
        unitId: unitDoc._id,
        variationName: v.unitName,
        containsQuantity: v.containsQuantity || 1,
        containsUnitId: containsUnitDoc?._id || unitDoc._id,
        conversionToBase: conversionMap.get(v.unitName.toLowerCase()),
        minSellingPrice: v.minSellingPrice
      };
    });

    const productDoc = {
      productName,
      baseUnit: {
        _id: baseUnitDoc._id,
        unitName: baseUnitDoc.unitName
      },
      units: unitsWithIds,
      variations: variationsWithIds,
      costPricePerBaseUnit: null,
      currentStock: 0,
      minStockLevel: minStockInBase,
      isActive: true,
      userId
    };

    const product = await productRepository.create(productDoc, session);

    return {
      _id: product._id,
      productName: product.productName,
      baseUnit: product.baseUnit,
      units: product.units,
      variations: product.variations,
      currentStock: product.currentStock,
      costPricePerBaseUnit: product.costPricePerBaseUnit,
      minStockLevel: product.minStockLevel,
      stockDisplay: formatStockDisplay(product),
    };
  }

  async updateProduct(productId, updateData, userId) {

    const product = await productRepository.findOne({
      _id: productId,
      userId,
      isActive: true
    });
    if (!product) {
      throw new AppError('Product not found', 404);
    }

    if (updateData.productName !== undefined) {
        const escapedName = updateData.productName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const existing = await productRepository.findOne({
          productName: { $regex: new RegExp(`^${escapedName}$`, 'i') },
          userId,
          isActive: true,
          _id: { $ne: productId }  // khud ko exclude karo
        });
      
        if (existing) {
          throw new AppError('Product with this name already exists', 409);
        }
      
        product.productName = updateData.productName;
    }

    if (updateData.minStockLevel !== undefined) {
      const { value, unit } = updateData.minStockLevel;
      
      // Product ke existing variations mein unit dhundho
      const variation = product.variations.find(
        v => v.variationName.toLowerCase() === unit.toLowerCase()
      );
      
      if (!variation) {
        throw new AppError(`Invalid unit: ${unit}`, 400);
      }

      // conversionToBase already stored hai — sirf multiply karo
      product.minStockLevel = value * variation.conversionToBase;
    }

    if (updateData.variations && Array.isArray(updateData.variations)) {
      for (const updatedVar of updateData.variations) {
        const variation = product.variations.find(
          v => v._id.toString() === updatedVar.variationId.toString()
        );
        if (variation && updatedVar.minSellingPrice !== undefined) {
          variation.minSellingPrice = updatedVar.minSellingPrice;
        }
      }
    }

    const updatedProduct = await productRepository.save(product);

    return {
      _id: updatedProduct._id,
      productName: updatedProduct.productName,
      minStockLevel: updatedProduct.minStockLevel,
      variations: updatedProduct.variations.map(v => ({
        _id: v._id,
        variationName: v.variationName,
        minSellingPrice: v.minSellingPrice
      }))
    };

  }

  async deleteProduct(productId, userId) {

    const product = await productRepository.findOne({
      _id: productId,
      userId,
      isActive: true
    });
    
    if (!product || !product.isActive) {
      throw new AppError('Product not found', 404);
    }

    product.isActive = false;
    await productRepository.save(product);

  }

}

module.exports = new ProductService();

