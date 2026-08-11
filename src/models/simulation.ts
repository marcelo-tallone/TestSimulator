export type SimulationType = 'ws' | 'mq';
export type SimulationStatus = 'stopped' | 'running' | 'error';
export type ResponseFormat = 'json' | 'xml' | 'soap' | 'text';
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'ANY';
export type MatchOperator = 'eq' | 'neq' | 'gt' | 'lt' | 'gte' | 'lte' | 'contains' | 'exists';
export type ConditionType = 'json-field' | 'xpath' | 'regex' | 'always';
export type VariableSource = 'json-field' | 'xpath' | 'header' | 'query' | 'fixed';

export interface WsConfig {
  port: number;
  path: string;
  method: HttpMethod;
  responseFormat: ResponseFormat;
  defaultStatusCode: number;
  defaultDelay?: number;
}

export interface MqConfig {
  host: string;
  port: number;
  queueManager: string;
  channel: string;
  user: string;
  password: string;
  inputQueue: string;
  outputQueue: string;
  useReplyToQueue: boolean;
  preserveCorrelId: boolean;
  responseFormat: ResponseFormat;
  defaultDelay?: number;
  protocol?: 'ibmmq' | 'stomp';
}

export interface MatchCondition {
  type: ConditionType;
  field?: string;
  operator?: MatchOperator;
  value?: string | number | boolean;
  expression?: string;
  pattern?: string;
  flags?: string;
  and?: MatchCondition[];
  or?: MatchCondition[];
}

export interface VariableMapping {
  name: string;
  source: VariableSource;
  path?: string;
  fixedValue?: string;
}

export interface ResponseConfig {
  templateFile?: string;
  inlineBody?: string | object;
  statusCode?: number;
  headers?: Record<string, string>;
  delay?: number;
  variables?: VariableMapping[];
}

export interface MatchingRule {
  id: string;
  name: string;
  priority: number;
  condition: MatchCondition;
  response: ResponseConfig;
}

export interface SimulationConfig {
  id: string;
  name: string;
  type: SimulationType;
  status: SimulationStatus;
  createdAt: string;
  updatedAt: string;
  ws?: WsConfig;
  mq?: MqConfig;
  rules: MatchingRule[];
  defaultResponse: ResponseConfig;
}

export interface CreateSimulationInput {
  name: string;
  type: SimulationType;
  ws?: WsConfig;
  mq?: MqConfig;
  rules?: MatchingRule[];
  defaultResponse: ResponseConfig;
}
