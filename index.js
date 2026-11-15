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

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

export default app;
