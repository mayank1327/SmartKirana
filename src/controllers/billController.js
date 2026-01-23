const billService = require('../services/BillService');

// Create new bill
const createBill = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const result = await billService.createBill(req.body, userId);

    res.status(201).json({
      success: true,
      message: 'Bill created successfully',
      data: {
        billId: result.bill._id,
        billNumber: result.bill.billNumber,
        finalTotal: result.bill.finalTotal,
        itemsCount: result.bill.items.length,
        stockUpdates: result.stockUpdates,
        temporaryProductsCount: result.tempProductsCount,
        warnings: result.warnings
      }
    });
  } catch (error) {
    next(error);
  }
};

// Get all bills
const getBills = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const result = await billService.getBills(req.query, userId);

    res.status(200).json({
      success: true,
      count: result.bills.length,
      pagination: result.pagination,
      data: result.bills
    });
  } catch (error) {
    next(error);
  }
};

// Get single bill
const getBill = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { billId } = req.params;
    const bill = await billService.getBillById(billId, userId);

    res.status(200).json({
      success: true,
      data: bill
    });
  } catch (error) {
    next(error);
  }
};

// Get today's bills
const getTodaysBills = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const result = await billService.getTodaysBills(userId);

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

// Get temporary products
const getTemporaryProducts = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const tempProducts = await billService.getTemporaryProducts(userId);

    res.status(200).json({
      success: true,
      count: tempProducts.length,
      data: tempProducts
    });
  } catch (error) {
    next(error);
  }
};

// Complete temporary product setup
const completeTemporaryProductSetup = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { tempProductId } = req.params;
    const result = await billService.completeTemporaryProductSetup(
      tempProductId,
      req.body,
      userId
    );

    res.status(200).json({
      success: true,
      message: 'Product setup completed successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

// Delete temporary product
const deleteTemporaryProduct = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { tempProductId } = req.params;
    const result = await billService.deleteTemporaryProduct(tempProductId, userId);

    res.status(200).json({
      success: true,
      message: result.message,
      data: {
        productName: result.productName,
        billsCount: result.billsCount
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createBill,
  getBills,
  getBill,
  getTodaysBills,
  getTemporaryProducts,
  completeTemporaryProductSetup,
  deleteTemporaryProduct
};