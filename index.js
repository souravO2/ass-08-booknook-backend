import express from "express";
import cors from "cors";
import { MongoClient } from "mongodb";
import "dotenv/config";
import { ObjectId } from "mongodb";

const app = express();
const PORT = 5000;

//middleware
app.use(cors());
app.use(express.json());

const client = new MongoClient(process.env.MDB_URI);
export async function connectToMongoDB() {
  try {
    await client.connect();
    console.log("Successfully connected to MongoDB");
    return client;
  } catch (error) {
    console.dir("Error connecting to MongoDB: ", error);
  }
}

const mongoClient = await connectToMongoDB();
const db = mongoClient.db("booknook");
const booksCollection = db.collection("books");
const borrowsCollection = db.collection("borrows");
await borrowsCollection.createIndex(
  { bookId: 1, userEmail: 1 },
  { unique: true },
);

app.get("/", (req, res) => {
  res.send("Welcome to BookNook API");
});

// books routes
app.post("/add-book", async (req, res) => {
  const data = req.body;
  const totalCopies = Number(data.totalCopies);
  const book = {
    ...data,
    totalCopies,
    availableCopies: totalCopies,
    createdAt: new Date(),
  };
  const result = await booksCollection.insertOne(book);
  res.send(result);
});

app.get("/all-books", async (req, res) => {
  const result = await booksCollection.find().toArray();
  res.send(result);
});

app.get("/all-books/:id", async (req, res) => {
  const { id } = req.params;
  const result = await booksCollection.findOne({ _id: new ObjectId(id) });
  res.send(result);
});

app.get("/new-arrivals", async (req, res) => {
  const result = await booksCollection
    .find()
    .sort({ createdAt: -1 })
    .limit(6)
    .toArray();
  res.send(result);
});

app.get("/top-categories", async (req, res) => {
  const result = await booksCollection
    .aggregate([
      {
        $group: {
          _id: "$category",
          count: { $sum: 1 },
          createdAt: { $max: "$createdAt" },
        },
      },
      { $sort: { count: -1, createdAt: -1 } },
      { $project: { _id: 0, name: "$_id", count: 1 } },
    ])
    .limit(5)
    .toArray();

  res.send(result);
});

app.get("/my-books/:email", async (req, res) => {
  const { email } = req.params;
  const result = await booksCollection
    .find({ userEmail: email })
    .sort({ createdAt: -1 })
    .toArray();
  res.send(result);
});

app.delete("/my-books/:id", async (req, res) => {
  const { id } = req.params;
  const result = await booksCollection.deleteOne({
    _id: new ObjectId(id),
  });
  res.send(result);
});

app.patch("/my-books/:id", async (req, res) => {
  const { id } = req.params;
  const updatedData = req.body;
  const book = await booksCollection.findOne({ _id: new ObjectId(id) });
  if (!book) {
    return res.status(404).send({ msg: "Book not Found" });
  }
  const borrowedCopies = book.totalCopies - book.availableCopies;
  const newTotalCopies = Number(updatedData.totalCopies);
  const result = await booksCollection.updateOne(
    {
      _id: new ObjectId(id),
    },
    {
      $set: {
        ...updatedData,
        totalCopies: newTotalCopies,
        availableCopies: newTotalCopies - borrowedCopies,
      },
    },
  );
  res.send(result);
});

//book borrowing
const LOAN_DAYS = 7;

app.post("/borrow-book", async (req, res) => {
  const { bookId, userEmail } = req.body;

  if (!ObjectId.isValid(bookId) || !userEmail) {
    return res.status(400).send({ msg: "Invaid request" });
  }
  const book = await booksCollection.findOne({ _id: new ObjectId(bookId) });
  if (!book) return res.status(404).send({ msg: "Book not found" });

  const borrow = {
    bookId,
    bookTitle: book.title,
    bookImage: book.bookImage,
    userEmail,
    borrowDate: new Date(),
    returnDate: new Date(Date.now() + LOAN_DAYS * 24 * 3600 * 1000),
  };
  try {
    await borrowsCollection.insertOne(borrow);
  } catch (err) {
    if (err.code === 11000) {
      return res
        .status(409)
        .send({ msg: "You have already borrowed this book" });
    }
    throw err;
  }
  const result = await booksCollection.updateOne(
    {
      _id: book._id,
      availableCopies: { $gt: 0 },
    },
    { $inc: { availableCopies: -1 } },
  );
  if (result.modifiedCount === 0) {
    await borrowsCollection.deleteOne({ _id: borrow._id });
    return res.send({ msg: "no copies available" });
  }
  res.send(borrow);
});

app.get("/my-borrows/:email", async (req, res) => {
  const { email } = req.params;
  const result = await borrowsCollection.find({ userEmail: email }).toArray();
  res.send(result);
});

app.delete("/my-borrows/:id", async (req, res) => {
  const { id } = req.params;
  if (!ObjectId.isValid(id)) {
    return res.status(404).send({ msg: "Borrow not found" });
  }
  const deleted = await borrowsCollection.findOneAndDelete({
    _id: new ObjectId(id),
  });
  const borrow = deleted?.value ?? deleted;
  if (!borrow) return res.status(404).send({ msg: "Borrow not found" });
  await booksCollection.updateOne(
    {
      _id: new ObjectId(borrow.bookId),
    },
    {
      $inc: { availableCopies: 1 },
    },
  );
  res.send({ success: true });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

export default app;
