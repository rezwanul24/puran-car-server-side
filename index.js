const express = require("express");
const cors = require("cors");
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const jwt = require("jsonwebtoken");

const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const app = express();

app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.wm2o919.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

// token function
function verifyJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).send("unauthorized access");
  }

  const token = authHeader.split(" ")[1];

  jwt.verify(token, process.env.ACCESS_TOKEN, function (err, decoded) {
    if (err) {
      return res.status(403).send({ message: "forbidden access" });
    }
    req.decoded = decoded;
    next();
  });
}

async function run() {
  try {
    const carCollection = client.db("puranCar").collection("carCollection");
    const usersCollection = client.db("puranCar").collection("user");
    const bookingCollection = client.db("puranCar").collection("booking");
    const reportCollection = client.db("puranCar").collection("report");
    const paymentsCollection = client.db("puranCar").collection("payment");

    const verifyAdmin = async (req, res, next) => {
      const requester = req.decoded.email;
      const requesterAccount = await usersCollection.findOne({
        email: requester,
      });
      if (requesterAccount.role === "admin") {
        next();
      } else {
        res.status(403).send({ message: "forbidden" });
      }
    };

    app.get("/jwt", async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      if (user) {
        const token = jwt.sign({ email }, process.env.ACCESS_TOKEN, {
          expiresIn: "1d",
        });
        return res.send({ accessToken: token });
      }
      res.status(403).send({ accessToken: "" });
    });

    //add & update  user
    app.put("/user/:email", async (req, res) => {
      const email = req.params.email;
      const user = req.body;
      const filter = { email: email };
      const options = { upsert: true };
      const updateDoc = {
        $set: user,
      };
      const result = await usersCollection.updateOne(
        filter,
        updateDoc,
        options
      );

      const token = jwt.sign(
        { email: email },
        process.env.ACCESS_TOKEN_SECRET,
        { expiresIn: "1d" }
      );

      res.send({ result, token });
    });

    // get user by email
    app.get("/role/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      res.send(user);
    });

    // add booking
    app.post("/addBooking", verifyJWT, async (req, res) => {
      const booking = req.body;
      const result = await bookingCollection.insertOne(booking);
      res.send(result);
    });

    // get product by email
    app.get("/myBuyers", async (req, res) => {
      const email = req.query.email;
      const query = { sellerEmail: email };
      const bikes = await bookingCollection.find(query).toArray();
      res.send(bikes);
    });

    // get booking
    app.get("/booking", async (req, res) => {
      const email = req.query.email;
      const query = { buyerEmail: email };
      const bikes = await bookingCollection.find(query).toArray();
      res.send(bikes);
    });

    // get booking
    app.get("/singleBooking/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const bikes = await bookingCollection.findOne(query);
      res.send(bikes);
    });

    // get bike
    app.get("/allBikes", async (req, res) => {
      const category = req.query.category;
      const query = { category: category };
      const bikes = await carCollection.find(query).toArray();
      res.send(bikes);
    });

    // get product by email
    app.get("/myProduct", async (req, res) => {
      const email = req.query.email;
      const query = { sellerEmail: email };
      const bikes = await carCollection.find(query).toArray();
      res.send(bikes);
    });

    // post bike
    app.post("/addProduct", verifyJWT, async (req, res) => {
      const product = req.body;
      const result = await carCollection.insertOne(product);
      res.send(result);
    });

    // delete bike
    app.delete("/deleteAdvertise/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: ObjectId(id) };
      const result = await carCollection.deleteOne(filter);
      res.send(result);
    });

    app.put("/addAdvertise/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;
      const body = req.body;
      const filter = { _id: ObjectId(id) };
      const options = { upsert: true };
      const updatedDoc = {
        $set: {
          ads: body.ads,
        },
      };
      const result = await carCollection.updateOne(filter, updatedDoc, options);
      res.send(result);
    });

    // get ads
    app.get("/getAdvertise", async (req, res) => {
      const query = { ads: true };
      const result = await carCollection.find(query).toArray();
      res.send(result);
    });

    // all seller
    app.get("/allSellersAndBuyers", async (req, res) => {
      const role = req.query.role;
      const query = { role: role };
      const seller = await usersCollection.find(query).toArray();
      res.send(seller);
    });

    // delete bike
    app.delete("/deleteSellerAndBuyer/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: ObjectId(id) };
      const result = await usersCollection.deleteOne(filter);
      res.send(result);
    });

    // verify seller
    app.patch("/verifySeller", verifyJWT, async (req, res) => {
      const email = req.query.email;
      const body = req.body;
      const filter = { email: email };
      const filterSeller = { sellerEmail: email };
      const options = { upsert: true };
      const updatedDoc = {
        $set: {
          isSellerVerify: body.isSellerVerify,
        },
      };
      const result = await usersCollection.updateOne(
        filter,
        updatedDoc,
        options
      );

      const postUpdate = await carCollection.updateMany(
        filterSeller,
        updatedDoc,
        options
      );

      res.send(result);
    });

    // addReport
    app.post("/addReport", verifyJWT, async (req, res) => {
      const product = req.body;
      const result = await reportCollection.insertOne(product);
      res.send(result);
    });

    // getReport
    app.get("/getReport", async (req, res) => {
      const query = {};
      const result = await reportCollection.find(query).toArray();
      res.send(result);
    });

    // delete report
    app.delete("/removeReport/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: ObjectId(id) };
      const result = await reportCollection.deleteOne(filter);
      res.send(result);
    });

    // delete post
    app.delete("/removePost/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;
      const productId = req.body.productId;

      const filter = { _id: ObjectId(id) };

      const filterProductId = { _id: ObjectId(productId) };

      const result = await reportCollection.deleteOne(filter);

      const resultProduct = await carCollection.deleteOne(filterProductId);

      res.send(result);
    });

    //create payment
    app.post("/create-payment-intent", async (req, res) => {
      const price = req.body.price;
      const amount = price * 100;
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });
      res.send({ clientSecret: paymentIntent.client_secret });
    });

    app.post("/payments/:id", async (req, res) => {
      const id = req.params.id;
      const payment = req.body;
      const result = await paymentsCollection.insertOne(payment);

      const filter = { _id: ObjectId(id) };
      const updatedDoc = {
        $set: {
          pay: "Paid",
          transactionId: payment.transactionId,
        },
      };
      const updatedResult = await bookingCollection.updateOne(
        filter,
        updatedDoc
      );

      const filterPost = { _id: ObjectId(payment.productId) };
      const updatedDocpost = {
        $set: {
          status: "Sold",
          ads: false,
        },
      };
      const updatedResultpost = await carCollection.updateOne(
        filterPost,
        updatedDocpost
      );

      res.send(result);
    });
  } finally {
  }
}

run().catch(console.log);

app.get("/", async (req, res) => {
  res.send("Puran Car server is running");
});

app.listen(port, () => {
  console.log("Puran Car running on port", port);
});
