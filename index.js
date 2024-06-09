

const express = require('express');
const cors = require('cors');
const app = express();
const jwt = require('jsonwebtoken');
const port = process.env.PORT || 5001;
require('dotenv').config()
const { MongoClient, ServerApiVersion, ObjectId, Timestamp } = require('mongodb');


// middlewire
app.use(cors());
app.use(express.json());


// verify middlewire
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
    next()
  })
}

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



    // survey related api
    app.get('/surveys/:id', async (req, res) => {
      const id = req.params.id;
      const cursor = { _id: new ObjectId(id) };
      const result = await surveyCollection.findOne(cursor);
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