import express from "express";
import axios, { all } from "axios";
import bodyParser from "body-parser";
import pg from "pg";

const app = express();
const port = 3000;

//Middleware
app.use(express.static("public"));
app.use(bodyParser.urlencoded({ extended: true }));

//Connect to database
const db = new pg.Client({
  user: "postgres",
  host: "localhost",
  database: "bookshelf",
  password: "PostgresinG",
  port: 5432,
});
db.connect();

//Variables
let featured = [];
let random = [];
let latest = [];
let invalidISBN = "";
let specifiedBook = [];
let allBooks = [];
let sortOption = "";
let allGenres = [];
let selectedGenre = "";
let sorted = "yes";

async function getFeatured() {
  try {
    const result = await db.query("SELECT * FROM books WHERE rating = 10 LIMIT 10;");
    featured = result.rows;
  } catch (err) {
    console.err(err);
  } 
};

async function randomBook() {
  if (featured != 0) {  
    const num = Math.floor(Math.random() * featured.length);
    random = featured[num];
    console.log(num);
  } else {};
};

async function getLatest() {
  try {
    const result = await db.query("SELECT * FROM books ORDER BY date_read DESC LIMIT 3;");
    latest = result.rows;
  } catch (err) {
    console.err(err);
  } 
};

async function getAllBooks() {
  try {
    const result = await db.query("SELECT * FROM books ORDER BY date_read DESC;");
    allBooks = result.rows;
  } catch (err) {
    console.error(err);
  } 
};

async function sortBooks() {
  if (sortOption === "date") {
    allBooks.sort((a, b) => new Date(b.date_read) - new Date(a.date_read))
  } else if (sortOption === "title") {
    allBooks.sort((a, b) => {
      if (a.title < b.title) return -1;
      if (a.title > b.title) return 1;
      return 0; // equal titles
    });
  } else if (sortOption === "rating") {
    allBooks.sort((a, b) => b.rating - a.rating);
  }
};

async function getGenres() {
  try {
    const result = await db.query("SELECT DISTINCT genre from books;")
    allGenres = result.rows;
  } catch (err) {
    console.error(err);
  }
};

async function getBooksByGenre() {
  try {
    const result = await db.query("SELECT * from books WHERE genre = $1 ORDER BY date_read DESC", [ selectedGenre ]);
    allBooks = result.rows;
  } catch (err) {
    console.error(err);
  }
}

//GET to home page
app.get("/", async (req, res) => {
  await getFeatured();
  await randomBook();
  await getLatest();
  res.render("index.ejs",
    { 
      lucky: random,
      featuredBooks: featured,
      latestBooks: latest,
      isbnError: invalidISBN,
    });
});

//GET navigate to add book if isbn is invalid
app.get("/#add-book", async (req, res) => {
  await getFeatured();
  await randomBook();
  await getLatest();
  res.render("index.ejs",
    { 
      lucky: random,
      featuredBooks: featured,
      latestBooks: latest,
      isbnError: invalidISBN,
    });
});

//POST new book journal
app.post("/add", async (req, res) => {
  const isbn = req.body.isbn;
  const title = req.body.title;
  const author = req.body.author;
  const genre = req.body.genre;
  const date = req.body.dateRead;
  const rating = req.body.rating;
  const review = req.body.review;
  const notes = req.body.notes;
  try {
    //GET book cover from API
    const result = await axios.get(`https://bookcover.longitood.com/bookcover/${isbn}`);
    const img_URL = result.data.url;
    //INSERT data
    try {
      await db.query("INSERT INTO books (isbn, title, author, genre, img_URL, date_Read, rating, review, notes)VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9);", [ isbn, title, author, genre, img_URL, date, rating, review, notes ]);
      invalidISBN = "";
      res.redirect("/");
    } catch (err) {
      console.error(err);
    }
  } catch (err) {
    console.error(err);
    invalidISBN = "Invalid input: Please use ISBN-13.";
    res.redirect("/#add-book");
  }
});

//GET to specific book journal by id
app.get("/journal/:id", async (req, res) => {
  const rawId = req.params.id.trim();
  const id = parseInt(rawId, 10); 
  if (isNaN(id)) {
    return res.status(400).send('Invalid ID');
  }

  try {
    const result = await db.query("SELECT * FROM books WHERE id = $1", [ id ]);
    specifiedBook = result.rows[0];
    res.render("journal.ejs",
      {
        book: specifiedBook,
        featuredBooks: featured
      }
    );
  } catch (err) {
    console.log(err);
  } 
});

//GET to edit page
app.get("/edit.ejs", async (req, res) => {
  const dateTimeString = specifiedBook.date_read;
  let dateOnly;
  if (typeof dateTimeString === 'string') {
    dateOnly = dateTimeString.split('T')[0];
  } else if (dateTimeString instanceof Date) {
    dateOnly = dateTimeString.toISOString().split('T')[0];
  } else {
    console.error('Invalid date format');
  }
  specifiedBook.date_read = dateOnly;
  res.render("edit.ejs", 
    {
      book: specifiedBook,
      isbnError: invalidISBN,
    }
  );
});

//UPDATE book journal
app.post("/modify", async (req, res) => {
  const isbn = req.body.isbn;
  const title = req.body.title;
  const author = req.body.author;
  const genre = req.body.genre;
  const date = req.body.dateRead;
  const rating = req.body.rating;
  const review = req.body.review;
  const notes = req.body.notes;
  const id = specifiedBook.id
  try {
    //GET book cover from API
    const result = await axios.get(`https://bookcover.longitood.com/bookcover/${isbn}`);
    const img_URL = result.data.url;
    //UPDATE data
    try {
      await db.query("UPDATE books set isbn = $1, title = $2, author = $3, genre = $4, img_URL = $5, date_Read = $6, rating = $7, review = $8, notes = $9 WHERE id = $10;", [ isbn, title, author, genre, img_URL, date, rating, review, notes, id ]);
      invalidISBN = "";
      res.redirect("/");
    } catch (err) {
      console.error(err);
    }
  } catch (err) {
    console.error(err);
    invalidISBN = "Invalid input: Please use ISBN-13.";
    res.redirect("/edit.ejs");
  }
});

//DELETE a book journal
app.post("/delete/:id", async (req, res) => {
  const id = specifiedBook.id;
  try {
    await db.query("DELETE FROM books WHERE id = $1", [id]);
    res.redirect("/");
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error deleting post" });
  }
});

//GET to books page
app.get("/books.ejs", async (req, res) => {
  await getAllBooks();
  await getGenres();
  selectedGenre = "";
  res.render("books.ejs", 
    {
      books: allBooks,
      genres: allGenres
    }
  );
});

//POST sort books
app.post("/sort", async (req, res) => {
  sortOption = req.body.sort;
  await sortBooks();
  await getGenres();
  const sortedBooksCount = allBooks.length;
  if (selectedGenre === "") {
    res.render("books.ejs", 
      {
        books: allBooks,
        genres: allGenres,
      }
    );
  } else {
    res.render("books.ejs", 
      {
        books: allBooks,
        genres: allGenres,
        theGenre: selectedGenre,
        booksCount: sortedBooksCount,
        theSort: sortOption
      }
    );
  }
});

//POST sort by genre
app.post("/genre", async (req, res) => {
  selectedGenre = req.body.genre;
  await getGenres();
  await getBooksByGenre();
  await sortBooks();
  const sortedBooksCount = allBooks.length;
  res.render("books.ejs", 
    {
      books: allBooks,
      genres: allGenres,
      theGenre: selectedGenre,
      booksCount: sortedBooksCount,
      theSort: sortOption
    }
  );
});

//GET to about page
app.get("/about.ejs", async (req, res) => {
  res.render("about.ejs");
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});