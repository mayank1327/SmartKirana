const billService = require('../services/billService');

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

module.exports = {
  createBill,
  getBills,
  getBill,
};