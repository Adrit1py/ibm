// Minimal sample Express service used as a parser test fixture.
// Not a real app — just enough real require()/call patterns to exercise
// ast_parser.analyze_js_file()'s dependency detection.

const express = require('express');
const redis = require('redis');
const { Pool } = require('pg');
const axios = require('axios');

const app = express();
const cache = redis.createClient();
const pool = new Pool({ host: 'postgres' });

app.get('/charge', async (req, res) => {
  const result = await axios.post(`${process.env.PAYMENT_API_URL}/charge`, {
    orderId: req.query.orderId,
  });
  res.json(result.data);
});

module.exports = app;
