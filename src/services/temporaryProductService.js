const mongoose = require('mongoose');
const temporaryProductRepository = require('../repositories/temporaryProductRepository');
const productService = require('./productService');
const AppError = require('../utils/AppError'); 

class TemporaryProductService {

  // Bill create hone ke baad call hoga — billService se
  async updateAfterBill(bill, userId, session) {
    const tempItems = bill.items.filter(item => item.isTemporary);
    
    if (tempItems.length === 0) return;

    const aggregated = {};
    tempItems.forEach(item => {
      const name = item.productName.toLowerCase();
      if (!aggregated[name]) {
        aggregated[name] = {
          productName: item.productName,
          totalRevenue: 0
        };
      }
      aggregated[name].totalRevenue += item.lineTotal;
    });

    for (const [key, data] of Object.entries(aggregated)) {
      const escaped = data.productName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      let tempProduct = await temporaryProductRepository.findOne({
        userId,
        productName: { $regex: new RegExp(`^${escaped}$`, 'i') }
      }, session);

      if (tempProduct) {
        tempProduct.billIds.push(bill._id);
        tempProduct.totalRevenue += data.totalRevenue;
        tempProduct.lastSoldDate = bill.billDate;
        await temporaryProductRepository.save(tempProduct, session);
      } else {
        await temporaryProductRepository.create({
          userId,
          productName: data.productName,
          billIds: [bill._id],
          totalRevenue: data.totalRevenue,
          lastSoldDate: bill.billDate,
          isPendingSetup: true
        }, session);
      }
    }
  }

  async getPendingProducts(query = {}, userId) {
    const { search } = query;
    
    const filter = { userId, isPendingSetup: true };
    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.productName = { $regex: escaped, $options: 'i' };
    }

    const tempProducts = await temporaryProductRepository.findAll(
      filter,
      { sort: { lastSoldDate: -1 } }
    );

    return tempProducts.map(tp => ({
      tempProductId: tp._id,
      productName: tp.productName,
      totalRevenue: tp.totalRevenue,
      billsCount: tp.billIds.length,
      lastSoldDate: tp.lastSoldDate
    }));
  }

  async setupProduct(tempProductId, productData, userId) {
    const session = await mongoose.startSession();

    return await session.withTransaction(async () => {
      const tempProduct = await temporaryProductRepository.findOne({
        _id: tempProductId,
        userId,
        isPendingSetup: true
      }, session);
      
      if (!tempProduct) {
        throw new AppError('Temporary product not found', 404);
      }

      const newProduct = await productService.createProduct(productData, userId, session);

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

  async deleteTemporaryProduct(tempProductId, userId) {
    const tempProduct = await temporaryProductRepository.findOne({
      _id: tempProductId,
      userId
    });
    
    if (!tempProduct) {
      throw new AppError('Temporary product not found', 404);
    }
    
    await temporaryProductRepository.deleteById(tempProductId);

    return {
      productName: tempProduct.productName,
      billsCount: tempProduct.billIds.length
    };
  }

}

module.exports = new TemporaryProductService();