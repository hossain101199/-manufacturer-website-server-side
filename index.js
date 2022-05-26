const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// ---------------------------------------------------------------------------------------------------------------
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.uvqc9.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

// ---------------------------------------------------------------------------------------------------------------
function verifyJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).send({ message: "UnAuthorized access" });
  }
  const token = authHeader.split(" ")[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
    if (err) {
      return res.status(403).send({ message: "Forbidden access" });
    }
    req.decoded = decoded;
    next();
  });
}

// ---------------------------------------------------------------------------
async function run() {
  try {
    await client.connect();
    const userCollection = client.db("aitch-s-light").collection("user");
    const reviewcollection = client.db("aitch-s-light").collection("reviews");
    const productcollection = client.db("aitch-s-light").collection("products");
    const Ordercollection = client.db("aitch-s-light").collection("Orders");
    // save user---------------------------------------------------------------------------
    app.put("/user/:email", async (req, res) => {
      const email = req.params.email;
      const user = req.body;
      const filter = { email: email };
      const options = { upsert: true };
      const updateDoc = {
        $set: user,
      };
      const result = await userCollection.updateOne(filter, updateDoc, options);
      const token = jwt.sign(
        { email: email },
        process.env.ACCESS_TOKEN_SECRET,
        { expiresIn: "1h" }
      );
      res.send({ result, token });
    });
    // verifyAdmin---------------------------------------------------------------------------
    const verifyAdmin = async (req, res, next) => {
      const requester = req.decoded.email;
      const requesterAccount = await userCollection.findOne({
        email: requester,
      });
      if (requesterAccount.role === "admin") {
        next();
      } else {
        res.status(403).send({ message: "Forbidden" });
      }
    };
    // verifyAdmin --------------------------------------------------------------------------
    app.get("/admin/:email", async (req, res) => {
      const email = req.params.email;
      const user = await userCollection.findOne({ email: email });
      const isAdmin = user?.role === "admin";
      res.send({ admin: isAdmin });
    });

    // ger all user---------------------------------------------------------------------------
    app.get("/user", async (req, res) => {
      const users = await userCollection.find().toArray();
      res.send(users);
    });
    // user to admin---------------------------------------------------------------------------
    app.put("/user/admin/:email", verifyJWT, verifyAdmin, async (req, res) => {
      const email = req.params.email;
      const filter = { email: email };
      const updateDoc = {
        $set: { role: "admin" },
      };
      const result = await userCollection.updateOne(filter, updateDoc);
      res.send(result);
    });
    // userInformation---------------------------------------------------------------------------
    app.put("/userInformation/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;
      const userInformation = req.body;
      const filter = { email: email };
      const options = { upsert: true };
      console.log(filter);
      console.log(userInformation.name);
      const updatedDoc = {
        $set: {
          name: userInformation.name,
          phone: userInformation.phone,
          linkedin: userInformation.linkedin,
          education: userInformation.education,
          address: userInformation.address,
        },
      };
      const result = await userCollection.updateOne(
        filter,
        updatedDoc,
        options
      );
      res.send(result);
    });

    // Add A Review ---------------------------------------------------------------------------
    app.post("/review", verifyJWT, async (req, res) => {
      const newReview = req.body;
      const Review = await reviewcollection.insertOne(newReview);
      res.send(Review);
    });
    // get  Review ---------------------------------------------------------------------------
    app.get("/review", async (req, res) => {
      const query = req.query;
      const cursor = reviewcollection.find(query);
      const result = await cursor.toArray();
      res.send(result);
    });
    // Add  products ---------------------------------------------------------------------------
    app.post("/product", verifyJWT, async (req, res) => {
      const newproducts = req.body;
      const products = await productcollection.insertOne(newproducts);
      res.send(products);
    });

    // Product count --------------------------------------------------------------------------
    app.get("/productCount", async (req, res) => {
      const products = await productcollection.estimatedDocumentCount();
      res.send({ products });
    });

    // get products---------------------------------------------------------------------------
    app.get("/products", async (req, res) => {
      const page = parseInt(req.query.page);
      const size = parseInt(req.query.size);
      const query = {};
      const cursor = productcollection.find(query);
      let products;
      if (page || size) {
        products = await cursor
          .skip(page * size)
          .limit(size)
          .toArray();
      } else {
        products = await cursor.toArray();
      }
      res.send(products);
    });
    // get  product ---------------------------------------------------------------------------
    app.get("/products", async (req, res) => {
      const query = req.query;
      const cursor = productcollection.find(query);
      const result = await cursor.toArray();
      res.send(result);
    });
    // get one api ---------------------------------------------------------------------------
    app.get("/product/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const product = await productcollection.findOne(query);
      res.send(product);
    });
    // Delete order -----------------------------------------------------------------------
    app.delete("/product/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const products = await productcollection.deleteOne(query);
      res.send(products);
    });

    // Add  Orders ---------------------------------------------------------------------------
    app.post("/orders", verifyJWT, async (req, res) => {
      const Order = req.body;
      const newOrder = await Ordercollection.insertOne(Order);
      res.send(newOrder);
    });
    // get  Orders ---------------------------------------------------------------------------
    app.get("/orders", async (req, res) => {
      const query = req.query;
      const cursor = Ordercollection.find(query);
      const result = await cursor.toArray();
      res.send(result);
    });
    // get one order -----------------------------------------------------------------------
    app.get("/orders/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const product = await Ordercollection.findOne(query);
      res.send(product);
    });
    // Delete order -----------------------------------------------------------------------
    app.delete("/orders/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const products = await Ordercollection.deleteOne(query);
      res.send(products);
    });

    // ---------------------------------------------------------------------------
  } finally {
    // await client.close();
  }
}
run().catch(console.dir);

// ---------------------------------------------------------------------------------------------------------------
// https://aitch-s-light.herokuapp.com/
app.get("/", (req, res) => {
  res.send("Hello from aitch light!");
});

app.listen(port, () => {
  console.log(`aitch light app listening on port ${port}`);
});
