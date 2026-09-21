import mongoose, { Schema, Document, Model, Types } from 'mongoose';
import { CategorieCharge } from './Facture.js';

export interface ICharge extends Document {
  categorie: CategorieCharge;
  montant: number;
  description: string;
  factureId?: Types.ObjectId;
  date: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ChargeSchema: Schema<ICharge> = new Schema(
  {
    categorie: {
      type: String,
      required: true,
      enum: ['Clinique', 'Hôtel', 'Transfert', 'Bloc', 'Chirurgie', 'Soins', 'Autre'],
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
    factureId: {
      type: Schema.Types.ObjectId,
      ref: 'Facture',
      index: true,
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
