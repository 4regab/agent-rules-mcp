# Node.js and Express Development Rules

- Last Updated: 2025-01-26
- Description: Node.js and Express.js development best practices and patterns
- Version: 1.0

## Project Structure

### Recommended Directory Structure
```
src/
├── controllers/     # Route handlers
├── middleware/      # Custom middleware
├── models/         # Data models
├── routes/         # Route definitions
├── services/       # Business logic
├── utils/          # Utility functions
├── config/         # Configuration files
├── types/          # TypeScript type definitions
└── tests/          # Test files
```

### Environment Configuration
- Use environment variables for configuration
- Provide default values and validation
- Use a configuration management library like `dotenv`

```typescript
// config/database.ts
import { z } from 'zod';

const configSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string(),
  JWT_SECRET: z.string().min(32),
});

export const config = configSchema.parse(process.env);
```

## Express Application Setup

### Application Structure
```typescript
// app.ts
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';

import { errorHandler } from './middleware/error-handler';
import { requestLogger } from './middleware/request-logger';
import { authRoutes } from './routes/auth';
import { userRoutes } from './routes/users';

const app = express();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true,
}));

// Rate limiting
app.use(rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Logging
app.use(requestLogger);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);

// Error handling (must be last)
app.use(errorHandler);

export { app };
```

### Server Entry Point
```typescript
// server.ts
import { app } from './app';
import { config } from './config';
import { connectDatabase } from './config/database';

async function startServer() {
  try {
    await connectDatabase();
    
    const server = app.listen(config.PORT, () => {
      console.log(`Server running on port ${config.PORT}`);
    });

    // Graceful shutdown
    process.on('SIGTERM', () => {
      console.log('SIGTERM received, shutting down gracefully');
      server.close(() => {
        console.log('Process terminated');
      });
    });

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
```

## Middleware Patterns

### Error Handling Middleware
```typescript
// middleware/error-handler.ts
import { Request, Response, NextFunction } from 'express';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public isOperational = true
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  let statusCode = 500;
  let message = 'Internal Server Error';

  if (error instanceof AppError) {
    statusCode = error.statusCode;
    message = error.message;
  } else if (error.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation Error';
  } else if (error.name === 'CastError') {
    statusCode = 400;
    message = 'Invalid ID format';
  }

  // Log error for debugging
  console.error('Error:', {
    message: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
  });

  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack }),
  });
};
```

### Authentication Middleware
```typescript
// middleware/auth.ts
import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { AppError } from './error-handler';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

export const authenticate = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      throw new AppError(401, 'Access token required');
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    req.user = decoded;
    
    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      next(new AppError(401, 'Invalid token'));
    } else {
      next(error);
    }
  }
};

export const authorize = (...roles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError(401, 'Authentication required'));
    }

    if (!roles.includes(req.user.role)) {
      return next(new AppError(403, 'Insufficient permissions'));
    }

    next();
  };
};
```

## Controller Patterns

### RESTful Controller Structure
```typescript
// controllers/user-controller.ts
import { Request, Response, NextFunction } from 'express';
import { UserService } from '../services/user-service';
import { AppError } from '../middleware/error-handler';

export class UserController {
  constructor(private userService: UserService) {}

  getUsers = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page = 1, limit = 10, search } = req.query;
      
      const users = await this.userService.getUsers({
        page: Number(page),
        limit: Number(limit),
        search: search as string,
      });

      res.json({
        success: true,
        data: users,
      });
    } catch (error) {
      next(error);
    }
  };

  getUserById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const user = await this.userService.getUserById(id);

      if (!user) {
        throw new AppError(404, 'User not found');
      }

      res.json({
        success: true,
        data: user,
      });
    } catch (error) {
      next(error);
    }
  };

  createUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userData = req.body;
      const user = await this.userService.createUser(userData);

      res.status(201).json({
        success: true,
        data: user,
      });
    } catch (error) {
      next(error);
    }
  };

  updateUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      
      const user = await this.userService.updateUser(id, updates);

      res.json({
        success: true,
        data: user,
      });
    } catch (error) {
      next(error);
    }
  };

  deleteUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      await this.userService.deleteUser(id);

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };
}
```

## Service Layer Pattern

### Business Logic Services
```typescript
// services/user-service.ts
import { UserRepository } from '../repositories/user-repository';
import { EmailService } from './email-service';
import { AppError } from '../middleware/error-handler';
import bcrypt from 'bcrypt';

export interface CreateUserData {
  name: string;
  email: string;
  password: string;
}

export interface UpdateUserData {
  name?: string;
  email?: string;
}

export class UserService {
  constructor(
    private userRepository: UserRepository,
    private emailService: EmailService
  ) {}

  async createUser(userData: CreateUserData) {
    // Check if user already exists
    const existingUser = await this.userRepository.findByEmail(userData.email);
    if (existingUser) {
      throw new AppError(409, 'User with this email already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(userData.password, 12);

    // Create user
    const user = await this.userRepository.create({
      ...userData,
      password: hashedPassword,
    });

    // Send welcome email
    await this.emailService.sendWelcomeEmail(user.email, user.name);

    // Return user without password
    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  async getUserById(id: string) {
    const user = await this.userRepository.findById(id);
    if (!user) {
      return null;
    }

    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  async getUsers(options: {
    page: number;
    limit: number;
    search?: string;
  }) {
    return this.userRepository.findMany(options);
  }

  async updateUser(id: string, updates: UpdateUserData) {
    const user = await this.userRepository.findById(id);
    if (!user) {
      throw new AppError(404, 'User not found');
    }

    // Check email uniqueness if email is being updated
    if (updates.email && updates.email !== user.email) {
      const existingUser = await this.userRepository.findByEmail(updates.email);
      if (existingUser) {
        throw new AppError(409, 'Email already in use');
      }
    }

    const updatedUser = await this.userRepository.update(id, updates);
    const { password, ...userWithoutPassword } = updatedUser;
    return userWithoutPassword;
  }

  async deleteUser(id: string) {
    const user = await this.userRepository.findById(id);
    if (!user) {
      throw new AppError(404, 'User not found');
    }

    await this.userRepository.delete(id);
  }
}
```

## Validation

### Input Validation with Zod
```typescript
// validation/user-validation.ts
import { z } from 'zod';

export const createUserSchema = z.object({
  body: z.object({
    name: z.string().min(2).max(50),
    email: z.string().email(),
    password: z.string().min(8).regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
      'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
    ),
  }),
});

export const updateUserSchema = z.object({
  body: z.object({
    name: z.string().min(2).max(50).optional(),
    email: z.string().email().optional(),
  }),
  params: z.object({
    id: z.string().uuid(),
  }),
});

// Validation middleware
export const validate = (schema: z.ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      schema.parse({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorMessages = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
        }));
        
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: errorMessages,
        });
      }
      next(error);
    }
  };
};
```

## Database Patterns

### Repository Pattern
```typescript
// repositories/user-repository.ts
import { Database } from '../config/database';

export interface User {
  id: string;
  name: string;
  email: string;
  password: string;
  createdAt: Date;
  updatedAt: Date;
}

export class UserRepository {
  constructor(private db: Database) {}

  async create(userData: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): Promise<User> {
    const query = `
      INSERT INTO users (name, email, password)
      VALUES ($1, $2, $3)
      RETURNING *
    `;
    
    const result = await this.db.query(query, [
      userData.name,
      userData.email,
      userData.password,
    ]);
    
    return result.rows[0];
  }

  async findById(id: string): Promise<User | null> {
    const query = 'SELECT * FROM users WHERE id = $1';
    const result = await this.db.query(query, [id]);
    return result.rows[0] || null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const query = 'SELECT * FROM users WHERE email = $1';
    const result = await this.db.query(query, [email]);
    return result.rows[0] || null;
  }

  async findMany(options: {
    page: number;
    limit: number;
    search?: string;
  }): Promise<{ users: User[]; total: number }> {
    const offset = (options.page - 1) * options.limit;
    let query = 'SELECT * FROM users';
    let countQuery = 'SELECT COUNT(*) FROM users';
    const params: any[] = [];

    if (options.search) {
      query += ' WHERE name ILIKE $1 OR email ILIKE $1';
      countQuery += ' WHERE name ILIKE $1 OR email ILIKE $1';
      params.push(`%${options.search}%`);
    }

    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(options.limit, offset);

    const [usersResult, countResult] = await Promise.all([
      this.db.query(query, params),
      this.db.query(countQuery, options.search ? [params[0]] : []),
    ]);

    return {
      users: usersResult.rows,
      total: parseInt(countResult.rows[0].count),
    };
  }

  async update(id: string, updates: Partial<User>): Promise<User> {
    const fields = Object.keys(updates);
    const values = Object.values(updates);
    
    const setClause = fields.map((field, index) => `${field} = $${index + 2}`).join(', ');
    const query = `
      UPDATE users 
      SET ${setClause}, updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;
    
    const result = await this.db.query(query, [id, ...values]);
    return result.rows[0];
  }

  async delete(id: string): Promise<void> {
    const query = 'DELETE FROM users WHERE id = $1';
    await this.db.query(query, [id]);
  }
}
```

## Testing

### Unit Testing with Jest
```typescript
// tests/services/user-service.test.ts
import { UserService } from '../../src/services/user-service';
import { UserRepository } from '../../src/repositories/user-repository';
import { EmailService } from '../../src/services/email-service';
import { AppError } from '../../src/middleware/error-handler';

// Mock dependencies
jest.mock('../../src/repositories/user-repository');
jest.mock('../../src/services/email-service');

describe('UserService', () => {
  let userService: UserService;
  let mockUserRepository: jest.Mocked<UserRepository>;
  let mockEmailService: jest.Mocked<EmailService>;

  beforeEach(() => {
    mockUserRepository = new UserRepository({} as any) as jest.Mocked<UserRepository>;
    mockEmailService = new EmailService() as jest.Mocked<EmailService>;
    userService = new UserService(mockUserRepository, mockEmailService);
  });

  describe('createUser', () => {
    it('should create a new user successfully', async () => {
      const userData = {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'Password123!',
      };

      mockUserRepository.findByEmail.mockResolvedValue(null);
      mockUserRepository.create.mockResolvedValue({
        id: '1',
        ...userData,
        password: 'hashedPassword',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      mockEmailService.sendWelcomeEmail.mockResolvedValue();

      const result = await userService.createUser(userData);

      expect(result).not.toHaveProperty('password');
      expect(result.name).toBe(userData.name);
      expect(result.email).toBe(userData.email);
      expect(mockEmailService.sendWelcomeEmail).toHaveBeenCalledWith(
        userData.email,
        userData.name
      );
    });

    it('should throw error if user already exists', async () => {
      const userData = {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'Password123!',
      };

      mockUserRepository.findByEmail.mockResolvedValue({
        id: '1',
        ...userData,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await expect(userService.createUser(userData)).rejects.toThrow(AppError);
      expect(mockUserRepository.create).not.toHaveBeenCalled();
    });
  });
});
```

### Integration Testing
```typescript
// tests/integration/user-routes.test.ts
import request from 'supertest';
import { app } from '../../src/app';
import { setupTestDatabase, cleanupTestDatabase } from '../helpers/database';

describe('User Routes', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await cleanupTestDatabase();
  });

  describe('POST /api/users', () => {
    it('should create a new user', async () => {
      const userData = {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'Password123!',
      };

      const response = await request(app)
        .post('/api/users')
        .send(userData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe(userData.name);
      expect(response.body.data.email).toBe(userData.email);
      expect(response.body.data).not.toHaveProperty('password');
    });

    it('should return validation error for invalid data', async () => {
      const invalidData = {
        name: 'J',
        email: 'invalid-email',
        password: '123',
      };

      const response = await request(app)
        .post('/api/users')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Validation error');
      expect(response.body.errors).toHaveLength(3);
    });
  });
});
```

## Security Best Practices

### Input Sanitization
- Always validate and sanitize user input
- Use parameterized queries to prevent SQL injection
- Implement rate limiting to prevent abuse
- Use HTTPS in production

### Authentication & Authorization
- Use strong password hashing (bcrypt with high salt rounds)
- Implement JWT tokens with appropriate expiration
- Use refresh tokens for long-lived sessions
- Implement role-based access control

### Error Handling
- Don't expose sensitive information in error messages
- Log errors for debugging but sanitize user-facing responses
- Use structured error responses
- Implement proper HTTP status codes