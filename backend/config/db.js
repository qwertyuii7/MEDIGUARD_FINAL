import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'

/**
 * Global is used here to maintain a cached connection across hot reloads
 * in development and across function invocations in serverless environments.
 */
let cached = global.mongoose

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null }
}

export const connectDB = async () => {
  const uri = process.env.MONGODB_URI

  if (!uri && process.env.NODE_ENV === 'production') {
    throw new Error('MONGODB_URI is not defined in environment variables')
  }

  if (cached.conn) {
    return cached.conn
  }

  if (!cached.promise) {
    const opts = {
      serverSelectionTimeoutMS: 5000,
      bufferCommands: true, // Set to true to avoid issues with models being used before connection
    }

    if (uri) {
      console.log('Connecting to MongoDB...')
      cached.promise = mongoose.connect(uri, opts).then((mongoose) => {
        console.log(`MongoDB Connected: ${mongoose.connection.host}`)
        return mongoose
      }).catch(async (error) => {
        console.error(`MongoDB Connection Error: ${error.message}`)
        
        // Only try fallback in development
        if (process.env.NODE_ENV !== 'production') {
          console.warn('Attempting to start local in-memory MongoDB fallback...')
          try {
            const mongod = await MongoMemoryServer.create({
              binary: {
                version: '6.0.1',
              }
            })
            const memoryUri = mongod.getUri()
            return mongoose.connect(memoryUri)
          } catch (memError) {
            console.error(`Critical: Memory Server fallback failed: ${memError.message}`)
            process.exit(1)
          }
        } else {
          throw error
        }
      })
    } else {
      // Fallback for development if URI is missing
      console.warn('MONGODB_URI missing. Starting local in-memory MongoDB fallback...')
      cached.promise = MongoMemoryServer.create({
        binary: { version: '6.0.1' }
      }).then(mongod => {
        const memoryUri = mongod.getUri()
        return mongoose.connect(memoryUri)
      }).then(conn => {
        console.log(`MongoDB Connected (In-Memory): ${conn.connection.host}`)
        return conn
      })
    }
  }

  try {
    cached.conn = await cached.promise
  } catch (e) {
    cached.promise = null
    throw e
  }

  return cached.conn
}
