const productService = require('../services/productService');

const getAllProducts = async (req, res, next) => {
  try {

    const userId = req.user._id;

    const result = await productService.getAllProducts(req.query, userId);
    
    res.status(200).json({
      success: true,
      count: result.products.length,
      pagination: result.pagination,
      data: result.products
    });
  } catch (error) {
    next(error);
  }
};

const getProduct = async (req, res, next) => {
  try {
    const productId = req.params.id;
    const userId = req.user._id;
    
    const product = await productService.getProductById(productId, userId);
    
    res.status(200).json({
      success: true,
      data: product
    });
  } catch (error) {
    next(error);
  }
};

const createProduct = async (req, res, next) => {
  try {
    const productData = req.body;
    const userId = req.user._id;
    
    const product = await productService.createProduct(productData, userId);
    
    res.status(201).json({
      success: true,
      message: 'Product created successfully',
      data: product
    });
  } catch (error) {
    next(error);
  }
};

const updateProduct = async (req, res, next) => {
  try {
    
    const productId = req.params.id;
    const updatedData = req.body;
    const userId = req.user._id;

    const product = await productService.updateProduct(productId, updatedData, userId);
    
    res.status(200).json({
      success: true,
      message: 'Product updated successfully',
      data: product
    });
  } catch (error) {
    next(error);
  }
};

const deleteProduct = async (req, res, next) => {
  try {

    const productId = req.params.id;
    const userId = req.user._id; 

    await productService.deleteProduct(productId, userId);
    
    res.status(200).json({
      success: true,
      message: 'Product deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct
};