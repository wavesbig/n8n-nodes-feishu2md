import type { Icon, ICredentialTestRequest, ICredentialType, INodeProperties } from 'n8n-workflow';

export class FeishuApi implements ICredentialType {
	name = 'feishuApi';
	displayName = 'Feishu API';
	documentationUrl = 'https://open.feishu.cn/document/client-docs/h5/development-guide/step1';
	icon: Icon = 'file:../icons/feishu2md.svg';

	// Validate credentials by requesting an app access token
	test: ICredentialTestRequest = {
		request: {
			baseURL: '=https://{{$credentials.baseUrl}}',
			url: `/open-apis/auth/v3/app_access_token/internal`,
			method: 'POST',
			body: {
				app_id: '={{$credentials.appid}}',
				app_secret: '={{$credentials.appsecret}}',
			},
		},
		rules: [
			{
				type: 'responseCode',
				properties: {
					value: 200,
					message: '授权验证失败',
				},
			},
		],
	};
	properties: INodeProperties[] = [
		{
			displayName: 'Base URL',
			name: 'baseUrl',
			type: 'string',
			default: 'open.feishu.cn',
			required: true,
		},
		{
			displayName: 'App ID',
			name: 'appId',
			type: 'string',
			description: '开放平台应用的唯一标识。可以在开发者后台的 凭证与基础信息 页面查看 app_id',
			default: '',
			required: true,
		},
		{
			displayName: 'App Secret',
			name: 'appSecret',
			description: '应用的秘钥',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
		},
	];
}
