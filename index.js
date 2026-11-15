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

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

export default app;
