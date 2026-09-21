import mongoose, { Schema, Document, Model, Types } from 'mongoose';
import { IPatient } from './Patient.js';

export interface IPrestation {
  designation: string;
  detail?: string;
  quantite: number;
  prixUnitaire: number;
}

export type CategorieCharge =
  | 'Clinique'
  | 'Hôtel'
  | 'Transfert'
  | 'Bloc'
  | 'Chirurgie'
  | 'Soins'
  | 'Autre';

export interface IChargeItem {
  categorie: CategorieCharge;
  montant: number;
  description: string;
}

export type TypeDocument = 'DEVIS' | 'FACTURE';
export type StatutPaiement = 'EN_ATTENTE' | 'PARTIEL' | 'PAYE';
export type ClientType = 'TUNISIEN' | 'ETRANGER';
export type Devise = 'TND' | 'EUR';

export interface ITransfertItem {
  designation: string;
  quantite: number;
  montant: number;
}

export interface IFacture extends Document {
  numeroFacture: string;
  type: TypeDocument;
  clientType: ClientType;
  devise: Devise;
  patientId: Types.ObjectId | IPatient;
  actePrincipal: string;
  prestations: IPrestation[];
  charges: IChargeItem[];
  totalHT: number;
  acompte: number;
  soldeRestant: number;
  margeNette: number;
  statutPaiement: StatutPaiement;
  anesthesie?: string;
  dureeEstimee?: string;
  dateIntervention?: string;
  dateEcheance?: string;
  modeReglement?: string;
  notes?: string;
  nomHotel?: string;
  nuitsHotel?: string;
  montantHotel?: number;
  nuitsAccompagnateurHotel?: string;
  montantAccompagnateurHotel?: number;
  transferts?: ITransfertItem[];
  dureeSejourClinique?: string;
  zonesTraitees?: string;
  validiteDevis?: string;
  dateDevis?: string;
  dateFacture?: string;
  dureeTotaleSejour?: string;
  interventionPrevue?: string;
  nuitsClinique?: number;
  createdAt: Date;
  updatedAt: Date;
}

const PrestationSchema = new Schema<IPrestation>(
  {
    designation: { type: String, required: true, trim: true },
    detail: { type: String, trim: true },
    quantite: { type: Number, required: true, default: 1, min: 1 },
    prixUnitaire: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const ChargeItemSchema = new Schema<IChargeItem>(
  {
    categorie: {
      type: String,
      required: true,
      enum: ['Clinique', 'Hôtel', 'Transfert', 'Bloc', 'Chirurgie', 'Soins', 'Autre'],
    },
    montant: { type: Number, required: true, min: 0 },
    description: { type: String, required: true, trim: true },
  },
  { _id: false }
);

const FactureSchema: Schema<IFacture> = new Schema(
  {
    numeroFacture: {
      type: String,
      required: [true, 'Le numéro de pièce est obligatoire'],
      unique: true,
      trim: true,
      index: true,
    },
    type: {
      type: String,
      required: true,
      enum: ['DEVIS', 'FACTURE'],
      default: 'FACTURE',
      index: true,
    },
    patientId: {
      type: Schema.Types.ObjectId,
      ref: 'Patient',
      required: [true, 'La référence du patient est obligatoire'],
      index: true,
    },
    actePrincipal: {
      type: String,
      required: [true, 'L\'acte principal est obligatoire (ex: Liposuccion, BBL)'],
      trim: true,
    },
    prestations: {
      type: [PrestationSchema],
      default: [],
      validate: [
        (val: IPrestation[]) => val.length > 0,
        'Au moins une prestation doit être incluse',
      ],
    },
    charges: {
      type: [ChargeItemSchema],
      default: [],
    },
    totalHT: {
      type: Number,
      required: true,
      min: 0,
    },
    acompte: {
      type: Number,
      default: 0,
      min: 0,
    },
    soldeRestant: {
      type: Number,
      required: true,
      min: 0,
    },
    margeNette: {
      type: Number,
      required: true,
    },
    statutPaiement: {
      type: String,
      enum: ['EN_ATTENTE', 'PARTIEL', 'PAYE'],
      default: 'EN_ATTENTE',
      index: true,
    },
    anesthesie: {
      type: String,
      default: 'Générale',
    },
    dureeEstimee: {
      type: String,
      default: '2h00',
    },
    dateIntervention: {
      type: String,
    },
    dateEcheance: {
      type: String,
    },
    modeReglement: {
      type: String,
      default: 'Virement bancaire / Espèces',
    },
    notes: {
      type: String,
      trim: true,
    },
    clientType: {
      type: String,
      enum: ['TUNISIEN', 'ETRANGER'],
      default: 'TUNISIEN',
      index: true,
    },
    devise: {
      type: String,
      enum: ['TND', 'EUR'],
      default: 'TND',
    },
    nomHotel: {
      type: String,
      trim: true,
      default: 'Hôtel Partenaire Clinique 5★',
    },
    nuitsHotel: {
      type: String,
      trim: true,
      default: '4 nuits',
    },
    montantHotel: {
      type: Number,
      default: 0,
      min: 0,
    },
    nuitsAccompagnateurHotel: {
      type: String,
      trim: true,
      default: '',
    },
    montantAccompagnateurHotel: {
      type: Number,
      default: 0,
      min: 0,
    },
    transferts: {
      type: [
        {
          designation: { type: String, required: true },
          quantite: { type: Number, default: 1 },
          montant: { type: Number, default: 0 },
        },
      ],
      default: [],
    },
    dureeSejourClinique: {
      type: String,
      default: '1 nuit',
      trim: true,
    },
    zonesTraitees: {
      type: String,
      default: 'Zones définies en consultation',
      trim: true,
    },
    validiteDevis: {
      type: String,
      default: '30 jours',
      trim: true,
    },
    dateDevis: {
      type: String,
      trim: true,
    },
    dateFacture: {
      type: String,
      trim: true,
    },
    dureeTotaleSejour: {
      type: String,
      trim: true,
    },
    interventionPrevue: {
      type: String,
      trim: true,
    },
    nuitsClinique: {
      type: Number,
      default: 1,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Calcul automatique avant sauvegarde : totalHT, soldeRestant, margeNette et statut
FactureSchema.pre('validate', function () {
  // Calcul du total des prestations
  const totalPres = (this.prestations || []).reduce(
    (acc, item) => acc + (item.quantite || 1) * (item.prixUnitaire || 0),
    0
  );

  // Pour les étrangers, ajouter l'hébergement et les transferts au total
  let extraSejour = 0;
  if (this.clientType === 'ETRANGER') {
    extraSejour += (this.montantHotel || 0) + (this.montantAccompagnateurHotel || 0);
    extraSejour += (this.transferts || []).reduce((acc, t) => acc + (t.montant || 0), 0);
  }

  this.totalHT = Math.round((totalPres + extraSejour) * 1000) / 1000;

  // Calcul des charges directes
  const totalCharges = (this.charges || []).reduce(
    (acc, charge) => acc + (charge.montant || 0),
    0
  );

  // Marge nette = Total - Somme des charges
  this.margeNette = Math.round((this.totalHT - totalCharges) * 1000) / 1000;

  // Solde restant = Total - Acompte
  const acompteSecurise = Math.min(this.acompte || 0, this.totalHT);
  this.soldeRestant = Math.round((this.totalHT - acompteSecurise) * 1000) / 1000;

  // Statut automatique
  if (this.soldeRestant === 0 && this.totalHT > 0) {
    this.statutPaiement = 'PAYE';
  } else if (acompteSecurise > 0) {
    this.statutPaiement = 'PARTIEL';
  } else {
    this.statutPaiement = 'EN_ATTENTE';
  }
});

export const Facture: Model<IFacture> =
  mongoose.models.Facture || mongoose.model<IFacture>('Facture', FactureSchema);
