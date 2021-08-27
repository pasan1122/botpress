import * as sdk from 'botpress/sdk'

interface ModelPrimaryKey {
  botId: string
  language: string
  state: 'ready' | 'training'
}

export interface ModelState extends ModelPrimaryKey {
  modelId: string
  definitionHash: string
}

export interface IModelStateRepository {
  get(key: ModelPrimaryKey): Promise<ModelState | undefined>
  has(key: ModelPrimaryKey): Promise<boolean>
  set(model: ModelState): Promise<void>
  del(key: ModelPrimaryKey): Promise<void>
  query(query: Partial<ModelState>): Promise<ModelState[]>
}

export class DbModelStateRepository implements IModelStateRepository {
  private _tableName = 'model_state'

  constructor(private _db: sdk.KnexExtended) {}

  public async initialize() {
    await this._db.createTableIfNotExists(this._tableName, table => {
      table.string('botId').notNullable()
      table.string('language').notNullable()
      table.string('state').notNullable()
      table.string('modelId').notNullable()
      table.string('definitionHash').notNullable()
      table.primary(['botId', 'language', 'state'])
    })
  }

  public async get(key: ModelPrimaryKey): Promise<ModelState | undefined> {
    return this._db
      .table(this._tableName)
      .where(key)
      .select('*')
      .first()
  }

  public async has(key: ModelPrimaryKey): Promise<boolean> {
    return !!(await this.get(key))
  }

  public async set(model: ModelState): Promise<void> {
    const { modelId, definitionHash, ...key } = model
    if (await this.has(key)) {
      return this._db
        .table(this._tableName)
        .where(key)
        .update(model)
    }
    return this._db.table(this._tableName).insert(model)
  }

  public async del(key: ModelPrimaryKey): Promise<void> {
    return this._db
      .table(this._tableName)
      .where(key)
      .del()
  }

  public async query(query: Partial<ModelState>): Promise<ModelState[]> {
    return this._db
      .table(this._tableName)
      .where(query)
      .select('*')
  }
}

export class InMemModelStateRepository implements IModelStateRepository {
  private _table: ModelState[] = []

  public async get(key: ModelPrimaryKey): Promise<ModelState | undefined> {
    return this._table.find(m => this._areSame(m, key))
  }

  public async has(key: ModelPrimaryKey): Promise<boolean> {
    return !!(await this.get(key))
  }

  public async set(newModel: ModelState): Promise<void> {
    const idx = this._table.findIndex(m => this._areSame(m, newModel))
    if (idx < 0) {
      this._table.push(newModel)
      return
    }
    this._table[idx] = newModel
  }

  public async del(key: ModelPrimaryKey): Promise<void> {
    const idx = this._table.findIndex(m => this._areSame(m, key))
    if (idx < 0) {
      return
    }
    this._table.splice(idx, 1)
  }

  public async query(query: Partial<ModelState>): Promise<ModelState[]> {
    return this._table.filter(m => this._satisfiesQuery(m, query))
  }

  private _satisfiesQuery = (m: ModelState, query: Partial<ModelState>) => {
    for (const field in query) {
      if (query[field] !== m[field]) {
        return false
      }
    }
    return true
  }

  private _areSame(key1: ModelPrimaryKey, key2: ModelPrimaryKey) {
    return key1.botId === key2.botId && key1.language === key2.language && key1.state === key2.state
  }
}