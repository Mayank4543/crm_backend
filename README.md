# CRM Backend

A Customer Relationship Management (CRM) backend service built with Node.js, featuring campaign management, customer segmentation, and order processing capabilities.

## Features

- Authentication and Authorization
- Campaign Management
- Customer Management
- Order Processing
- Customer Segmentation
- Message Delivery System
- Redis Integration for Caching
- Swagger API Documentation

## Project Structure

```
src/
├── api/
│   ├── controllers/
│   ├── middlewares/
│   └── routes/
├── config/
├── consumers/
├── models/
├── services/
└── utils/
```

## Prerequisites

- Node.js
- Redis
- PostgreSQL/Supabase

## Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Configure your environment variables
4. Run the database setup:
   ```bash
   psql -f supabase_setup.sql
   ```
5. Start the server:
   ```bash
   npm start
   ```

## API Documentation

The API documentation is available through Swagger UI when the server is running.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
