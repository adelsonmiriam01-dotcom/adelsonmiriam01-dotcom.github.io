import 'dotenv/config';
import app from './src/app.js';

const PORT = process.env.PORT || 3000;

// Render requires binding to 0.0.0.0 and using the PORT env var it provides.
app.listen(PORT, '0.0.0.0', () => {
  console.log(`PrimeTrust API listening on 0.0.0.0:${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
