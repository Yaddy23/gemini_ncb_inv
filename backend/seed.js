const mongoose = require('mongoose');
const User = require('./models/User');
const Book = require('./models/Book');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/book-inventory', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(async () => {
  console.log('Connected to MongoDB');

  // Clear existing data
  await User.deleteMany({});
  await Book.deleteMany({});
  console.log('Cleared existing data');

  // Create admin user
  const adminUser = await User.create({
    username: 'admin',
    email: 'admin@bookinventory.com',
    password: 'admin123',
    role: 'Admin',
    isActive: true
  });

  // Create staff user
  const staffUser = await User.create({
    username: 'staff',
    email: 'staff@bookinventory.com',
    password: 'staff123',
    role: 'Staff',
    isActive: true
  });

  console.log('Created users:', adminUser.username, staffUser.username);

  // Create sample books
  const sampleBooks = [
    {
      ISBN: '9780134685991',
      SUBJECT: 'Computer Science',
      TITLE: 'Effective Java',
      EDITION: '3rd',
      YEAR: '2017',
      AUTHOR: 'Joshua Bloch',
      BIND: 'Hardcover',
      QTY: 15,
      PRICE: 45.99,
      PUBLISHER: 'Addison-Wesley Professional'
    },
    {
      ISBN: '9780132350884',
      SUBJECT: 'Computer Science',
      TITLE: 'Clean Code',
      EDITION: '1st',
      YEAR: '2008',
      AUTHOR: 'Robert C. Martin',
      BIND: 'Paperback',
      QTY: 22,
      PRICE: 38.50,
      PUBLISHER: 'Prentice Hall'
    },
    {
      ISBN: '9780262033848',
      SUBJECT: 'Computer Science',
      TITLE: 'Introduction to Algorithms',
      EDITION: '3rd',
      YEAR: '2009',
      AUTHOR: 'Thomas H. Cormen',
      BIND: 'Hardcover',
      QTY: 8,
      PRICE: 85.00,
      PUBLISHER: 'MIT Press'
    },
    {
      ISBN: '9780134092669',
      SUBJECT: 'Computer Science',
      TITLE: 'Cracking the Coding Interview',
      EDITION: '6th',
      YEAR: '2015',
      AUTHOR: 'Gayle Laakmann McDowell',
      BIND: 'Paperback',
      QTY: 30,
      PRICE: 32.99,
      PUBLISHER: 'CareerCup'
    },
    {
      ISBN: '9781491950357',
      SUBJECT: 'Computer Science',
      TITLE: 'Designing Data-Intensive Applications',
      EDITION: '1st',
      YEAR: '2017',
      AUTHOR: 'Martin Kleppmann',
      BIND: 'Hardcover',
      QTY: 12,
      PRICE: 42.50,
      PUBLISHER: "O'Reilly Media"
    }
  ];

  const createdBooks = await Book.insertMany(sampleBooks);
  console.log(`Created ${createdBooks.length} sample books`);

  console.log('Seeding completed successfully!');
  console.log('Admin credentials: admin@bookinventory.com / admin123');
  console.log('Staff credentials: staff@bookinventory.com / staff123');

  process.exit(0);
})
.catch((error) => {
  console.error('Seeding failed:', error);
  process.exit(1);
});