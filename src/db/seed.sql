-- Seed products catalog for E-Commerce API
INSERT INTO products (sku, name, description, category, price, stock, is_active)
VALUES
    ('PROD-TECH-001', 'Cloud Developer Laptop Pro 15', 'High-performance 32GB RAM workstation for cloud engineers', 'Electronics', 1499.99, 25, TRUE),
    ('PROD-TECH-002', 'Ultra-Wide Curved Monitor 34"', '4K USB-C high refresh rate workspace display', 'Electronics', 649.50, 15, TRUE),
    ('PROD-TECH-003', 'Mechanical Ergonomic Keyboard', 'Wireless split mechanical keyboard with hot-swappable switches', 'Accessories', 189.00, 50, TRUE),
    ('PROD-TECH-004', 'Active Noise-Cancelling Headphones', 'Spatial audio with 40-hour battery life for deep focus', 'Audio', 299.99, 40, TRUE),
    ('PROD-CLOTH-001', 'DevOps Heavyweight Hoodie', 'Comfortable organic cotton developer hoodie with discreet logo', 'Apparel', 65.00, 100, TRUE),
    ('PROD-CLOTH-002', 'CI/CD Pipeline Graphic Tee', 'Breathable cotton tee celebrating zero-downtime releases', 'Apparel', 28.50, 120, TRUE),
    ('PROD-BOOK-001', 'Site Reliability Engineering Handbook', 'Production best practices for distributed systems', 'Books', 45.00, 60, TRUE),
    ('PROD-BOOK-002', 'Designing Data-Intensive Applications', 'Definitive guide to data architecture and scalability', 'Books', 52.00, 35, TRUE),
    ('PROD-OFFICE-001', 'Adjustable Motorized Standing Desk', 'Dual motor sit-stand bamboo desk frame with memory presets', 'Office', 480.00, 10, TRUE),
    ('PROD-OFFICE-002', 'Ergonomic Mesh Task Chair', 'Lumbar support breathable chair for extended engineering sessions', 'Office', 320.00, 18, TRUE)
ON CONFLICT (sku) DO NOTHING;
