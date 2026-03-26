import GoogleStrategy from 'passport-google-oauth20';
import { v4 as uuidv4 } from 'uuid';
import pool from '../db/connection.js';
import AuthService from './auth.js';

export function initializeGoogleStrategy(passport) {
  // Only initialize Google OAuth if credentials are provided
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    console.log('⚠️  Google OAuth not configured - skipping initialization');
    return;
  }

  passport.use(
    new GoogleStrategy.Strategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: `/api/users/auth/google/callback`
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const email = profile.emails[0].value;
          const name = profile.displayName;
          const googleId = profile.id;

          // Check if user exists
          let result = await pool.query(
            'SELECT id, email, name FROM users WHERE email = $1',
            [email]
          );

          let userId;
          if (result.rows.length === 0) {
            // Create new user with Google OAuth
            userId = uuidv4();
            const now = new Date();
            const generatedPassword = uuidv4(); // Random password for OAuth users

            await pool.query(
              'INSERT INTO users (id, email, password, name, google_id, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7)',
              [userId, email, generatedPassword, name, googleId, now, now]
            );
          } else {
            // User exists, update google_id if not set
            userId = result.rows[0].id;
            if (!result.rows[0].google_id) {
              await pool.query(
                'UPDATE users SET google_id = $1 WHERE id = $2',
                [googleId, userId]
              );
            }
          }

          // Generate JWT token
          const token = AuthService.generateToken(userId);

          return done(null, { userId, token, email, name });
        } catch (error) {
          return done(error);
        }
      }
    )
  );

  passport.serializeUser((user, done) => {
    done(null, user.userId);
  });

  passport.deserializeUser(async (userId, done) => {
    try {
      const result = await pool.query(
        'SELECT id, email, name FROM users WHERE id = $1',
        [userId]
      );
      if (result.rows.length === 0) {
        return done(null, false);
      }
      done(null, result.rows[0]);
    } catch (error) {
      done(error);
    }
  });
}

export default initializeGoogleStrategy;
