export type ConnectorTextBlock = {
  type: 'connector_text';
  connector_text: string;
};

export function isConnectorTextBlock(param: any): param is ConnectorTextBlock {
  return param && param.type === 'connector_text';
}
