#!/usr/bin/env node

/**
 * 测试重构后的 API 认证逻辑
 */

const BASE_URL = 'http://localhost:3000';

// 测试用的用户密钥
const TEST_USER_KEY = 'test-user-key-123';

/**
 * 发送 API 请求
 */
async function makeRequest(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const defaultHeaders = {
    'Content-Type': 'application/json',
    'x-user-key': TEST_USER_KEY,
    'x-is-trial': 'false',
    'x-lang': 'zh',
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { ...defaultHeaders, ...options.headers },
      body: options.body ? JSON.stringify(options.body) : undefined,
      ...options,
    });

    const data = await response.json();
    return {
      status: response.status,
      data,
      ok: response.ok,
    };
  } catch (error) {
    return {
      status: 0,
      data: { error: error.message },
      ok: false,
    };
  }
}

/**
 * 测试用例
 */
const testCases = [
  {
    name: '测试 service/create 路由',
    endpoint: '/api/service/create',
    body: {
      resumeId: 'test-resume-id',
      jdId: 'test-jd-id',
      step: 'a',
      model: 'deepseek-v3.2',
    },
  },
  {
    name: '测试 upload/resume 路由',
    endpoint: '/api/upload/resume',
    body: {
      text: '这是一个测试简历内容',
      filename: 'test-resume.txt',
    },
  },
  {
    name: '测试 upload/jd 路由',
    endpoint: '/api/upload/jd',
    body: {
      text: '这是一个测试职位描述',
      filename: 'test-jd.txt',
    },
  },
  {
    name: '测试 run 路由',
    endpoint: '/api/run',
    body: {
      serviceId: 'test-service-id',
    },
  },
  {
    name: '测试 rag/query 路由',
    endpoint: '/api/rag/query',
    body: {
      query: '测试查询',
    },
  },
  {
    name: '测试 rag/documents 路由',
    endpoint: '/api/rag/documents',
    body: {},
  },
];

/**
 * 测试无效用户密钥
 */
async function testInvalidUserKey() {
  console.log('\n🔒 测试无效用户密钥...');
  
  const result = await makeRequest('/api/service/create', {
    headers: {
      'x-user-key': '', // 空的用户密钥
    },
    body: {
      resumeId: 'test-resume-id',
      jdId: 'test-jd-id',
      step: 'a',
      model: 'deepseek-v3.2',
    },
  });

  if (result.status === 401) {
    console.log('✅ 无效用户密钥测试通过');
  } else {
    console.log('❌ 无效用户密钥测试失败:', result);
  }
}

/**
 * 运行所有测试
 */
async function runTests() {
  console.log('🚀 开始测试重构后的 API 认证逻辑...\n');

  // 测试无效用户密钥
  await testInvalidUserKey();

  console.log('\n📋 测试各个 API 端点...');

  for (const testCase of testCases) {
    console.log(`\n🔍 ${testCase.name}`);
    
    const result = await makeRequest(testCase.endpoint, {
      body: testCase.body,
    });

    console.log(`   状态码: ${result.status}`);
    console.log(`   响应: ${JSON.stringify(result.data, null, 2)}`);
    
    if (result.ok || result.status === 400 || result.status === 404) {
      console.log('   ✅ 请求成功处理');
    } else {
      console.log('   ❌ 请求处理异常');
    }
  }

  console.log('\n🎉 测试完成！');
}

// 运行测试
runTests().catch(console.error);