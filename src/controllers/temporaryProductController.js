const temporaryProductService = require('../services/temporaryProductService');

const getPendingProducts = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const result = await temporaryProductService.getPendingProducts(req.query, userId);

    res.status(200).json({
      success: true,
      count: result.length,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

const setupProduct = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { tempProductId } = req.params;
    const result = await temporaryProductService.setupProduct(tempProductId, req.body, userId);

    res.status(201).json({
      success: true,
      message: 'Product setup completed successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

const deleteTemporaryProduct = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { tempProductId } = req.params;
    const result = await temporaryProductService.deleteTemporaryProduct(tempProductId, userId);

    res.status(200).json({
      success: true,
      message: 'Temporary product deleted successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getPendingProducts,
  setupProduct,
  deleteTemporaryProduct,
};