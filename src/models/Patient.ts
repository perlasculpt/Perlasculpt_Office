import mongoose, { Schema, Document, Model } from 'mongoose';
import { CryptoService } from '../services/cryptoService.js';

export interface IPatient extends Document {
  nomPrenom: string;
  passeportEncrypted: string;
  nationalite: string;
  telephone: string;
  paysResidence: string;
  dateNaissance?: string;
  createdAt: Date;
  updatedAt: Date;
  getPasseport(): string;
  setPasseport(plaintext: string): void;
}

const PatientSchema: Schema<IPatient> = new Schema(
  {
    nomPrenom: {
      type: String,
      required: [true, 'Le nom et prénom du patient sont obligatoires'],
      trim: true,
      index: true,
    },
    passeportEncrypted: {
      type: String,
      required: [true, 'Le numéro de passeport ou CIN chiffré est obligatoire'],
    },
    nationalite: {
      type: String,
      default: 'Tunisienne',
      trim: true,
    },
    telephone: {
      type: String,
      required: [true, 'Le numéro de téléphone est obligatoire'],
      trim: true,
    },
    paysResidence: {
      type: String,
      default: 'Tunisie',
      trim: true,
    },
    dateNaissance: {
      type: String,
      trim: true,
      default: '',
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Méthode pour obtenir le numéro de passeport déchiffré
PatientSchema.methods.getPasseport = function (this: IPatient): string {
  return CryptoService.decrypt(this.passeportEncrypted);
};

// Méthode pour définir le numéro de passeport chiffré
PatientSchema.methods.setPasseport = function (this: IPatient, plaintext: string): void {
  this.passeportEncrypted = CryptoService.encrypt(plaintext);
};

export const Patient: Model<IPatient> =
  mongoose.models.Patient || mongoose.model<IPatient>('Patient', PatientSchema);
