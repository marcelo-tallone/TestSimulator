export interface RequestLog {
  id: string;
  simulationId: string;
  timestamp: string;
  type: 'ws' | 'mq';
  method?: string;
  path?: string;
  requestHeaders?: Record<string, string>;
  requestBody?: string;
  responseStatusCode?: number;
  responseBody?: string;
  inputQueue?: string;
  outputQueue?: string;
  correlationId?: string;
  messageBody?: string;
  responseMessageBody?: string;
  matchedRuleId?: string | null;
  matchedRuleName?: string | null;
  processingTimeMs: number;
}
