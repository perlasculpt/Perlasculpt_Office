import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface ICharge extends Document {
  typeCharge: 'DIRECTE' | 'FIXE';
  categorie: string; // 👈 Lazem tkon string 3adi hna
  montant: number;
  description: string;
  date: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ChargeSchema: Schema<ICharge> = new Schema(
  {
    typeCharge: {
      type: String,
      enum: ['DIRECTE', 'FIXE'],
      required: true,
      default: 'FIXE',
      index: true,
    },
    categorie: {
      type: String, // 👈 Lazem Schema.Types.String
      required: true,
      index: true,
    },
    montant: {
      type: Number,
      required: true,
      min: 0,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    date: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

export const Charge: Model<ICharge> =
  mongoose.models.Charge || mongoose.model<ICharge>('Charge', ChargeSchema);