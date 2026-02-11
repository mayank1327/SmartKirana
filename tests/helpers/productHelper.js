const mongoose = require('mongoose');
const Product = require('../../src/models/Product');

/**
 * Create a test product with proper Phase 2 structure
 * @param {Object} userId - The user ID
 * @param {Object} config - Product configuration
 * @returns {Promise<Product>}
 */
async function createPhase2Product(userId, config) {
  const {
    productName,
    units, // Array of unit names: ['piece', 'packet', 'carton']
    variations, // Array of variation configs
    costPricePerBaseUnit = null,
    currentStock = 0,
    minStockLevel = null
  } = config;

  // Generate IDs for units
  const unitIds = units.map(() => new mongoose.Types.ObjectId());
  const baseUnitId = unitIds[0]; // First unit is always base

  // Build units array
  const unitsArray = units.map((unitName, index) => ({
    _id: unitIds[index],
    unitName: unitName.toLowerCase(),
    isBaseUnit: index === 0
  }));

  // Build variations array
  const variationsArray = variations.map((varConfig, index) => {
    const unitId = unitIds[varConfig.unitIndex];
    const containsUnitId = unitIds[varConfig.containsUnitIndex];
    
    return {
      _id: new mongoose.Types.ObjectId(),
      unitId,
      variationName: varConfig.variationName,
      containsQuantity: varConfig.containsQuantity,
      containsUnitId,
      conversionToBase: varConfig.conversionToBase,
      minSellingPrice: varConfig.minSellingPrice || null
    };
  });

  return await Product.create({
    userId,
    productName,
    baseUnit: {
      _id: baseUnitId,
      unitName: units[0].toLowerCase()
    },
    units: unitsArray,
    variations: variationsArray,
    costPricePerBaseUnit,
    currentStock,
    minStockLevel,
    isActive: true
  });
}

/**
 * Quick helper for creating Maggi test product (3 units)
 */
async function createMaggiTestProduct(userId) {
  return await createPhase2Product(userId, {
    productName: 'Maggi Noodles',
    units: ['piece', 'packet', 'carton'],
    variations: [
      {
        unitIndex: 0, // Piece
        variationName: 'Piece',
        containsQuantity: 1,
        containsUnitIndex: 0, // Contains Piece
        conversionToBase: 1,
        minSellingPrice: 5
      },
      {
        unitIndex: 1, // Packet
        variationName: 'Packet',
        containsQuantity: 24,
        containsUnitIndex: 0, // Contains Piece
        conversionToBase: 24,
        minSellingPrice: 120
      },
      {
        unitIndex: 2, // Carton
        variationName: 'Carton',
        containsQuantity: 6,
        containsUnitIndex: 1, // Contains Packet
        conversionToBase: 144,
        minSellingPrice: 700
      }
    ],
    costPricePerBaseUnit: 4.17,
    currentStock: 1440 // 10 cartons
  });
}

/**
 * Quick helper for creating Parle-G test product (2 units)
 */
async function createParleTestProduct(userId) {
  return await createPhase2Product(userId, {
    productName: 'Parle-G',
    units: ['piece', 'packet'],
    variations: [
      {
        unitIndex: 0, // Piece
        variationName: 'Piece',
        containsQuantity: 1,
        containsUnitIndex: 0,
        conversionToBase: 1,
        minSellingPrice: 2
      },
      {
        unitIndex: 1, // Packet
        variationName: 'Packet',
        containsQuantity: 10,
        containsUnitIndex: 0,
        conversionToBase: 10,
        minSellingPrice: 20
      }
    ],
    costPricePerBaseUnit: 1.5,
    currentStock: 500 // 50 packets
  });
}

module.exports = {
  createPhase2Product,
  createMaggiTestProduct,
  createParleTestProduct
};