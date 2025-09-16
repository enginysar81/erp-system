# Overview

This is a product catalog management system (ERP) built with Node.js, Express, and EJS template engine. The application allows users to manage product information including pricing, stock levels, and images. It features a comprehensive filtering system with URL persistence and supports internationalization in Turkish, Polish, and Ukrainian languages. The system is designed for curtain/textile product management with features like product cards, statistics overview, and image viewing capabilities.

**Architecture**: Single-server EJS application with traditional server-side rendering
**Production Ready**: Includes security middleware (Helmet), compression, and health monitoring

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture

The application uses server-side rendering with EJS templates:

- **Template Engine**: EJS for dynamic HTML generation
- **Styling**: Bootstrap CSS with custom styling for consistent design
- **Interactivity**: Vanilla JavaScript for filtering, modals, and form handling
- **Responsive Design**: Mobile-first approach with collapsible filters and touch-friendly interfaces
- **Client-Side Features**: Advanced filtering with URL query persistence, image lightbox, and statistics modals

The frontend follows a traditional MVC pattern with EJS views, server-side routing, and progressive enhancement through JavaScript.

## Backend Architecture

The server-side uses Node.js with Express in a consolidated single-server architecture:

- **Web Framework**: Express.js with TypeScript
- **Template Rendering**: EJS server-side rendering for all pages
- **Storage Layer**: JSON file-based storage for products and attributes data
- **API Design**: RESTful API endpoints for statistics and data operations
- **Security**: Helmet middleware, compression, and CSRF protection ready
- **Validation**: Zod schemas for runtime type checking and validation
- **Development**: Hot reload with tsx for rapid development cycles

The backend implements a traditional MVC pattern with centralized routing, file-based storage, and comprehensive error handling. All routes serve EJS templates with no client-side applications.

## Data Storage Solutions

- **Development**: JSON file-based storage in `/data` directory for rapid prototyping
- **Products**: Comprehensive product data with pricing, inventory, descriptions, and image arrays
- **Attributes**: Configurable product attributes with OPTIONS and TEXT types
- **Type Safety**: Zod schemas for runtime validation and TypeScript type safety

The storage system is designed for product management with support for multi-currency pricing, image management, and flexible attribute systems. Ready for database migration with existing Drizzle ORM schemas.

## Authentication and Authorization

Currently implements a basic session-based authentication structure with user management interfaces defined in the storage layer. The system is prepared for session management with connect-pg-simple for PostgreSQL session storage.

## External Dependencies

- **Production Security**: Helmet for security headers, compression for performance
- **File Uploads**: Multer for image handling with type validation and size limits
- **Icons**: FontAwesome 6.4.0 for consistent iconography
- **Image Handling**: Server-side upload processing with lightbox viewing
- **Health Monitoring**: `/healthz` endpoint for deployment health checks
- **Development Tools**: 
  - ESBuild for production bundling
  - tsx for TypeScript development
  - Drizzle Kit for future database migrations

The system is optimized for production deployment with security middleware, error handling, and monitoring capabilities. Architecture is consolidated to a single Node.js + Express + EJS stack.