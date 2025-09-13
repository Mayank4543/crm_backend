const express = require("express");
const { validate, schemas } = require("../middlewares/validation.middleware");
const orderService = require("../../services/order.service");

const router = express.Router();
const validateOrderCreation = validate(schemas.orderSchema);

router.post("/", validateOrderCreation, async (req, res, next) => {
  try {
    const result = await orderService.createOrder(req.body);

    res.status(201).json({
      success: true,
      message: "Order created successfully",
      orderRef: result.ref,
    });
  } catch (err) {
    next(err);
  }
});

router.get("/", async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;

    const result = await orderService.getOrders(page, limit);

    res.status(200).json({
      success: true,
      data: result.orders,
      pagination: {
        total: result.total,
        page,
        limit,
        pages: Math.ceil(result.total / limit),
      },
    });
  } catch (err) {
    next(err);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const order = await orderService.getOrderById(req.params.id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    res.status(200).json({
      success: true,
      data: order,
    });
  } catch (err) {
    next(err);
  }
});

// Delete order by ID
router.delete("/:id", async (req, res, next) => {
  try {
    const deletedOrder = await orderService.deleteOrder(req.params.id);

    res.status(200).json({
      success: true,
      message: "Order deleted successfully",
      data: deletedOrder,
    });
  } catch (err) {
    next(err);
  }
});

// Update order by ID
router.put("/:id", async (req, res, next) => {
  try {
    const updatedOrder = await orderService.updateOrder(req.params.id, req.body);

    res.status(200).json({
      success: true,
      message: "Order updated successfully",
      data: updatedOrder,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
