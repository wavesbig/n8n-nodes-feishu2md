import type { ICredentialType, INodeProperties } from 'n8n-workflow';

export class FeishuApi implements ICredentialType {
  name = 'feishuApi';
  displayName = 'Feishu API';
  properties: INodeProperties[] = [
    {
      displayName: 'App ID',
      name: 'appId',
      type: 'string',
      default: '',
      required: true,
    },
    {
      displayName: 'App Secret',
      name: 'appSecret',
      type: 'string',
      typeOptions: { password: true },
      default: '',
      required: true,
    },
  ];
}