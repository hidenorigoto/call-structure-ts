import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { ProductController } from '../controllers/productController';
import { validateRequest } from '../middleware/validateRequest';
import { adminOnly } from '../middleware/adminOnly';

const router = Router();
const productController = new ProductController();

// Get all products
router.get('/',
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('category').optional().isString(),
  query('minPrice').optional().isFloat({ min: 0 }),
  query('maxPrice').optional().isFloat({ min: 0 }),
  query('search').optional().isString(),
  validateRequest,
  productController.getAllProducts
);

// Get product by ID
router.get('/:id',
  param('id').isUUID(),
  validateRequest,
  productController.getProductById
);

// Create new product (admin only)
router.post('/',
  adminOnly,
  body('name').notEmpty().trim().isLength({ min: 2, max: 200 }),
  body('description').notEmpty().trim(),
  body('price').isFloat({ min: 0 }),
  body('category').notEmpty().trim(),
  body('stock').isInt({ min: 0 }),
  body('sku').notEmpty().trim(),
  validateRequest,
  productController.createProduct
);

// Update product (admin only)
router.put('/:id',
  adminOnly,
  param('id').isUUID(),
  body('name').optional().trim().isLength({ min: 2, max: 200 }),
  body('description').optional().trim(),
  body('price').optional().isFloat({ min: 0 }),
  body('category').optional().trim(),
  body('stock').optional().isInt({ min: 0 }),
  validateRequest,
  productController.updateProduct
);

// Delete product (admin only)
router.delete('/:id',
  adminOnly,
  param('id').isUUID(),
  validateRequest,
  productController.deleteProduct
);

// Get product categories
router.get('/meta/categories',
  productController.getCategories
);

// Get product statistics (admin only)
router.get('/stats/summary',
  adminOnly,
  productController.getProductStats
);

export { router as productRouter };