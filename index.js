

const express = require('express');
const cors = require('cors');
const app = express();
const jwt = require('jsonwebtoken');
const port = process.env.PORT || 5001;
require('dotenv').config()
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)
const { MongoClient, ServerApiVersion, ObjectId, Timestamp } = require('mongodb');


const corsOptions = {
  origin: ['http://localhost:5173',
    'https://surveyatlas-1e204.web.app',
    'https://surveyatlas-1e204.firebaseapp.com',
  ],
}
// middlewire

app.use(cors(corsOptions));
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
    const commentsCollection = dataBase.collection('comments');
    const reportsCollection = dataBase.collection('reports');
    const votesCollection = dataBase.collection('votes');


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
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const isAdmin = user?.role === 'Admin';
      if (!isAdmin) {
        return res.status(403).send({ message: "forbidden access" });
      }
      next()
    }

    // verify surveyor middlewire
    const verifySurveyor = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const isSurveyor = user?.role === 'Surveyor';
      if (!isSurveyor) {
        return res.status(403).send({ message: "forbidden access" });
      }
      next()
    }

    const verifyProUser = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const isProUser = user?.role === 'Pro-User';
      if (!isProUser) {
        return res.status(403).send({ message: "forbidden access" });
      }
      next()
    }
    // common verified middlewire
    const verifySurveyorAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const isSurveyorAdmin = user?.role === 'Surveyor' || user?.role === 'Admin';
      if (!isSurveyorAdmin) {
        return res.status(403).send({ message: "forbidden access" });
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

    // user related api starts
    app.post('/user', async (req, res) => {
      const user = req.body;
      const query = { email: user?.email };
      const existUser = await usersCollection.findOne(query);
      if (existUser) {
        return res.send({ message: "user already exists", insertedId: null })
      }
      const result = await usersCollection.insertOne(user);
      res.send(result);
    })

    app.get('/users', verifyToken, verifyAdmin, async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    })

    app.get('/user/:email', verifyToken, async (req, res) => {
      const email = req.params.email;
      const result = await usersCollection.findOne({ email });
      res.send(result);
    })
    // user related api ends

    // survey related api starts
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

    app.get('/totalSurveys', verifyToken, verifySurveyorAdmin, async (req, res) => {
      const result = await surveyCollection.find().toArray();
      res.send(result);
    })

    app.patch('/totalsurvey/update/:id', verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const statusInfo = req.body;
      const query = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: { ...statusInfo }
      };
      console.log(updateDoc)
      const result = await surveyCollection.updateOne(query, updateDoc);
      res.send(result);
    })

    app.get('/surveys/:id', async (req, res) => {
      const id = req.params.id;
      const cursor = { _id: new ObjectId(id) };
      const result = await surveyCollection.findOne(cursor);
      res.send(result);
    })

    // survey posting to database
    const formatDate = (dateString) => {
      const date = new Date(dateString);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0'); // Months are zero-based
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    app.post('/survey', verifyToken, verifySurveyor, async (req, res) => {
      try {
        const surveyInfo = req.body;
        const query = {
          ...surveyInfo,
          status: 'publish',
          report: 0,
          creationTime: formatDate(new Date()),
        }
        const result = await surveyCollection.insertOne(query);
        res.send(result);
      }
      catch (error) {
        res.status(500).send({ message: 'Error creating survey', error });
      }
    })
    // survey related api ends


    // comment related api starts
    app.post('/comment', verifyToken, verifyProUser, async (req, res) => {
      const paymentInfo = req.body;
      const result = await commentsCollection.insertOne(paymentInfo);
      res.send(result);
    })

    app.get('/comments', verifyToken, async (req, res) => {
      const result = await commentsCollection.find().toArray();
      console.log(result);
      res.send(result);
    })

    app.get("/comment/:commentid", async (req, res) => {
      const commentid = req.params.commentid;
      const query = { commentId: commentid };
      const result = await commentsCollection.find(query).toArray();
      res.send(result);
    })

    app.get('/comments/:email', verifyToken, verifyProUser, async (req, res) => {
      const email = req.params.email;
      const query = { userEmail: email };
      const result = await commentsCollection.find(query).toArray();
      res.send(result);
    })
    // comment related api ends


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

    // payment related api starts
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

    app.post('/payments', verifyToken, async (req, res) => {
      const paymentInfo = req.body;
      const paymentResult = await paymentsCollection.insertOne(paymentInfo);
      const query = { email: paymentInfo?.email };
      const isExist = await usersCollection.findOne(query);
      let roleResult = null;
      if (isExist) {
        const updateDoc = {
          $set: { role: 'Pro-User' }
        }
        roleResult = await usersCollection.updateOne(query, updateDoc);
      }
      res.send({ paymentResult, roleResult })
    })

    app.get('/payment', verifyToken, verifyAdmin, async (req, res) => {
      const result = await paymentsCollection.find().toArray();
      res.send(result);
    })
    // payment related api ends


    // report related api starts
    app.post('/report', verifyToken, async (req, res) => {
      const reportInfo = req.body;
      const surveyId = reportInfo.surveyId
      const query = {
        userEmail: reportInfo.userEmail,
        surveyId: reportInfo.surveyId,
      }
      const alreadyExist = await reportsCollection.findOne(query);
      if (alreadyExist) {
        return res.status(400).send("you have already reported this survey")
      }
      const result = await reportsCollection.insertOne(reportInfo);

      const cursor = { _id: new ObjectId(surveyId) };

      const isExist = await surveyCollection.findOne(cursor);

      let reportResult = null
      if (isExist) {
        const updateDoc = {
          $inc: { report: 1 }
        }
        reportResult = await surveyCollection.updateOne(cursor, updateDoc)
      }
      res.send({ result, reportResult });
    })

    app.get('/reports/:email', verifyToken, async (req, res) => {
      const email = req.params.email;
      const query = { userEmail: email };
      const result = await reportsCollection.find(query).toArray();
      res.send(result);
    })

    // report related api ends

    // votes related api starts
    app.post('/vote/', async (req, res) => {
      const voteInformation = req.body;
      const surveyId = voteInformation.surveyId
      const query = {
        voterEmail: voteInformation.voterEmail,
        surveyId: voteInformation.surveyId,
      }
      const alreadyExist = await votesCollection.findOne(query);
      if (alreadyExist) {
        return res.status(400).send("you have already voted in this survey. So you can't vote again")
      }
      const result = await votesCollection.insertOne(voteInformation);
      console.log(result);
      res.send(result)
    })
    // vote related api ends

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