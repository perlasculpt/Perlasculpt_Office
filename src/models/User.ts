import mongoose, { Schema, Document, Model } from 'mongoose';

export type UserRole = 'ADMIN' | 'OPERATEUR' | 'MEDECIN';

export interface IUser extends Document {
  telegramId: number;
  username?: string;
  firstName?: string;
  role: UserRole;
  isAuthorized: boolean;
  pinVerifiedAt?: Date;
  lastActive: Date;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema: Schema<IUser> = new Schema(
  {
    telegramId: {
      type: Number,
      required: true,
      unique: true,
      index: true,
    },
    username: {
      type: String,
      trim: true,
    },
    firstName: {
      type: String,
      trim: true,
    },
    role: {
      type: String,
      enum: ['ADMIN', 'OPERATEUR', 'MEDECIN'],
      default: 'OPERATEUR',
    },
    isAuthorized: {
      type: Boolean,
      default: false,
    },
    pinVerifiedAt: {
      type: Date,
    },
    lastActive: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

export const User: Model<IUser> =
  mongoose.models.User || mongoose.model<IUser>('User', UserSchema);
