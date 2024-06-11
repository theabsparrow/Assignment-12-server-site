

const express = require('express');
const cors = require('cors');
const app = express();
const jwt = require('jsonwebtoken');
const port = process.env.PORT || 5001;
require('dotenv').config()
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)
const { MongoClient, ServerApiVersion, ObjectId, Timestamp } = require('mongodb');


// middlewire
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.psgygfs.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {

    // Connect the client to the server	(optional starting in v4.7)

    const dataBase = client.db('SurveyAtlas');
    const surveyCollection = dataBase.collection('surveys');
    const usersCollection = dataBase.collection('users');
    const paymentsCollection = dataBase.collection('payments');

    
// verify jwt middlewire
const verifyToken = (req, res, next) => {
  if (!req.headers.authorization) {
    return res.status(401).send({ message: 'forbidden access' });
  }
  const token = req.headers.authorization.split(' ')[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (error, decoded) => {
    if (error) {
      return res.status(401).send({ message: 'forbidden access' })
    }
    req.decoded = decoded;
    next();
  })
}

    // verify admin middlewire
const verifyAdmin = async (req, res, next) => {
  const email = req.decoded.email;
  const query = {email: email};
  const user = await usersCollection.findOne(query); 
  const isAdmin = user?.role === 'Admin';
  if(!isAdmin){
    return res.status(403). send({message: "forbidden access"});
  }
 next()
}

// verify surveyor middlewire
const verifySurveyor = async (req, res, next) => {
  const email = req.decoded.email;
  const query = {email: email};
  const user = await usersCollection.findOne(query); 
  const isSurveyor = user?.role === 'Surveyor';
  if(!isSurveyor){
    return res.status(403). send({message: "forbidden access"});
  }
 next()
}
// common verified middlewire
const verifySurveyorAdmin = async (req, res, next) => {
  const email = req.decoded.email;
  const query = {email: email};
  const user = await usersCollection.findOne(query); 
  const isSurveyorAdmin = user?.role === 'Surveyor' || user?.role === 'Admin';
  if(!isSurveyorAdmin){
    return res.status(403). send({message: "forbidden access"});
  }
 next()
}

    // jwt related api
    app.post('/jwt', async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: '100h'
      });
      res.send({ token });
    })

    // user related api
    app.post('/user', async (req, res) => {
      const user = req.body;
      const query = { email: user?.email };
      const existUser = await usersCollection.findOne(query);
      if(existUser) {
        return res.send({message: "user already exists", insertedId: null})
      }
      const result = await usersCollection.insertOne(user);
      res.send(result);
    })

    app.get('/users', verifyToken, verifyAdmin, async(req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    })

    app.get('/user/:email', verifyToken, async(req, res) => {
      const email = req.params.email;
      const result = await usersCollection.findOne({email});
      res.send(result);
    })

    // survey related api
    app.get('/surveys', async (req, res) => {
      const filter = req.query.filter;
      const sort = req.query.sort
      let query = {};
      if (filter) {
        query = { ...query, category: filter }
      }
      let options = {};
      if (sort) {
        options = { sort: { totalVotes: sort === "asc" ? 1 : -1 } }
      }
      const result = await surveyCollection.find(query, options).toArray()
      res.send(result)
    })

    app.get('/totalSurveys', verifyToken, verifySurveyorAdmin, async(req, res) => {
      const result = await surveyCollection.find().toArray();
      res.send(result);
    })

    app.get('/surveys/:id', async (req, res) => {
      const id = req.params.id;
      const cursor = { _id: new ObjectId(id) };
      const result = await surveyCollection.findOne(cursor);
      res.send(result);
    })

    // user related api
    app.put('/user', async (req, res) => {
      const user = req.body;
      const options = { upsert: true }
      const query = { email: user?.email }
      const updateDoc = {
        $set: {
          ...user
        },
      }
      const result = await usersCollection.updateOne(query, updateDoc, options)
    })

    // payment related api
    app.post('/create-payment-intent', async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);
      console.log(amount, 'amount inside the intent')

      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: 'usd',
        payment_method_types: ['card']
      });

      res.send({
        clientSecret: paymentIntent.client_secret
      })
    });

    app.post('/payments', verifyToken, async(req, res) => {
      const paymentInfo = req.body;
      const paymentResult = await paymentsCollection.insertOne(paymentInfo);
      const query = {email: paymentInfo?.email};
      const isExist = await usersCollection.findOne(query);
      let roleResult = null;
      if(isExist){
        const updateDoc = {
          $set: {role: 'Pro-User'}
        }
        const roleResult = await usersCollection.updateOne(query, updateDoc);
      }
      res.send({paymentResult, roleResult})
    })

    app.get('/payment', verifyAdmin, async(req, res) => {
      const result = await paymentsCollection.find().toArray();
      res.send(result);
    })
    

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get('/', (req, res) => {
  res.send("server is running");
})

app.listen(port, () => {
  console.log(`server is running on port ${port}`);
})