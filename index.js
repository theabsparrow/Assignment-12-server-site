

const express = require('express');
const cors = require('cors');
const app = express();
const jwt = require('jsonwebtoken');
const port = process.env.PORT || 5001;
require('dotenv').config()
const { MongoClient, ServerApiVersion } = require('mongodb');


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

    // jwt related api
    app.post('/jwt', async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: '100h'
      });
      res.send({ token });
    })

    // survey related api
    app.get('/surveys', async(req, res) => {
      const filter = req.query.filter;
      const sort = req.query.sort
      let query = {};
      if (filter) {
        query = { ...query, category: filter }
      }
      let options = {};
      if(sort) {
        options = {sort: {totalVotes: sort==="asc"? 1: -1 }}
      }
      const result = await surveyCollection.find(query, options).toArray()
      res.send(result)
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