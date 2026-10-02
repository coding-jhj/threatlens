import rawRules from './rules.json'
import { loadRules } from '../domain/rules'

export const RULES = loadRules(rawRules)
