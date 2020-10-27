import React, { useEffect, useState, useRef } from 'react';
import { PageContainer, PageLoading } from '@ant-design/pro-layout';
import { Card, Alert, notification, Space } from 'antd';
import ProForm, { ProFormText } from '@ant-design/pro-form';
import AgoraRTC from 'agora-rtc-sdk';

const APP_ID = '26bdaf3f250242cc91c40775c660988e';

const LocalVideoBox: React.FC<{
  clientRef: React.MutableRefObject<any>;
  uid: string;
}> = ({ uid, clientRef }) => {
  const domRef = useRef<string>(`local_${Date.now()}`);
  const localStreamRef = useRef<any>();
  useEffect(() => {
    const localStream = AgoraRTC.createStream({
      streamID: uid,
      audio: true,
      video: false,
      screen: false,
    });
    localStreamRef.current = localStream;

    localStream.init(
      () => {
        console.log('初始化成功');
        // play stream with html element id "local_stream"
        localStream.play(domRef.current);
        // 发布本地流
        clientRef.current?.publish?.(localStream, (err: any) => {
          console.log('发布成功');
          console.error(err);
        });
      },
      (err: any) => {
        console.error('获取本地流失败', err);
      },
    );
  }, []);

  return (
    <div
      id={domRef.current}
      style={{
        width: 400,
        height: 200,
        backgroundColor: 'rgba(0,0,0,0.65)',
      }}
    />
  );
};

const OtherVideoBox: React.FC<{
  steam: any;
  uid: string;
}> = ({ uid, steam }) => {
  const domRef = useRef<string>(`${uid}_${Date.now()}`);
  useEffect(() => {
    steam.play(domRef.current);
  }, []);
  return (
    <div
      key={uid}
      id={domRef.current}
      style={{
        width: 400,
        height: 200,
        backgroundColor: 'rgba(0,0,0,0.65)',
      }}
    />
  );
};

/**
 * @name 生成一个 rtc 的实例
 * @returns success 为true 成功，为false 失败，undefined 加载中
 */
const useInitAgoraRTC: () => [React.MutableRefObject<any>, boolean | undefined] = () => {
  const clientRef = useRef();
  const [success, setSuccess] = useState<boolean>();

  useEffect(() => {
    const client = AgoraRTC.createClient({ mode: 'rtc', codec: 'h264' });
    client.init(
      APP_ID,
      () => {
        console.log('😘init success');
        setSuccess(true);
      },
      (err: any) => {
        console.error(err);
        setSuccess(false);
      },
    );
    clientRef.current = client;

    return () => {
      client.leave();
    };
  }, []);
  return [clientRef, success];
};

export default (): React.ReactNode => {
  const [uid, setUid] = useState<string>('');
  const [clientRef, success] = useInitAgoraRTC();
  const [videoList, setVideoList] = useState<string[]>([]);
  const videoMapRef = useRef<Map<string, any>>(new Map());
  useEffect(() => {
    if (!uid) return;
    clientRef.current.on('stream-added', (evt: any) => {
      const remoteStream = evt.stream;
      const id = remoteStream.getId();
      if (!videoMapRef.current.has(id) && !remoteStream.local) {
        clientRef.current.subscribe(remoteStream, (err: any) => {
          console.log('流订阅失败', err);
        });
      }
    });

    clientRef.current.on('stream-subscribed', (evt: any) => {
      const remoteStream = evt.stream;
      const id = remoteStream.getId();
      videoMapRef.current.set(id, remoteStream);
      setVideoList(Array.from(videoMapRef.current.keys()));
    });

    clientRef.current.on('stream-removed', (evt: any) => {
      const remoteStream = evt.stream;
      const id = remoteStream.getId();
      videoMapRef.current.delete(id);
      setVideoList(Array.from(videoMapRef.current.keys()));
    });
    clientRef.current.on('peer-leave', (evt: any) => {
      const remoteStream = evt.stream;
      const id = remoteStream.getId();
      videoMapRef.current.delete(id);
      setVideoList(Array.from(videoMapRef.current.keys()));
    });
  }, [uid]);

  if (success === undefined) {
    return <PageLoading />;
  }

  return (
    <PageContainer>
      <Card>
        <Alert
          message={success ? '服务器连接成功' : '服务器连接失败'}
          type={success ? 'success' : 'error'}
          showIcon
          banner
          style={{
            margin: -12,
            marginBottom: 24,
          }}
        />
        {!uid && (
          <ProForm
            onFinish={async ({ room }) => {
              clientRef.current?.join(
                null,
                room,
                null,
                (newUid: string) => {
                  notification.success({
                    message: '房间加入成功',
                    description: `加入房间${room} 成功, uid为 ${newUid}`,
                  });
                  setUid(newUid);
                },
                (err: any) => {
                  console.error('client join failed', err);
                },
              );
            }}
          >
            <ProFormText
              name="room"
              initialValue="root"
              label="房间号"
              tooltip="房间号相同才能登陆"
              rules={[
                {
                  required: true,
                },
              ]}
            />
            <ProFormText
              name="userName"
              label="用户名"
              initialValue={`张三-${(Math.random() * 10).toFixed(0)}`}
            />
          </ProForm>
        )}

        {uid && (
          <Space>
            <LocalVideoBox uid={uid} clientRef={clientRef} />
            {videoList.map((videoUid) => {
              return (
                <OtherVideoBox
                  steam={videoMapRef.current.get(videoUid)}
                  uid={videoUid}
                  key={videoUid}
                />
              );
            })}
          </Space>
        )}
      </Card>
    </PageContainer>
  );
};
