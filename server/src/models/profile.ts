import mongoose, { Schema, model, models } from 'mongoose';

export const LEGACY_PROFILE_ID = 'legacy';

export interface ProfileDoc {
  _id: string;
  contentVersion: number;
  legacy: boolean;
  claimed: boolean;
  claimedBy: string;
  lastSeenAt: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

const profileSchema = new Schema<ProfileDoc>(
  {
    _id: { type: String, required: true },
    contentVersion: { type: Number, default: 0 },
    legacy: { type: Boolean, default: false },
    claimed: { type: Boolean, default: false },
    claimedBy: { type: String, default: '' },
    lastSeenAt: { type: Date, default: null },
  },
  { timestamps: true, versionKey: false, _id: false }
);

export const Profile =
  (models.Profile as mongoose.Model<ProfileDoc> | undefined) ?? model<ProfileDoc>('Profile', profileSchema);

export type ProfileModel = mongoose.Model<ProfileDoc>;
