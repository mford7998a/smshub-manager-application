import { BaseModel } from './BaseModel';
import { ModemRecord } from '../types/database';

export class ModemModel extends BaseModel {
  static tableName = 'modems';

  // Model validations
  static validate(data: Partial<ModemRecord>): boolean {
    // Validation logic
  }

  // Model relationships
  static relationships = {
    messages: {
      type: 'hasMany',
      model: 'MessageModel',
      foreignKey: 'modemId'
    },
    stats: {
      type: 'hasMany',
      model: 'StatsModel',
      foreignKey: 'modemId'
    }
  };
} 