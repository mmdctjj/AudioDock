import {
  CheckSquareOutlined,
  CloseOutlined,
  DownloadOutlined,
  PlayCircleOutlined,
  PlaySquareOutlined,
  PlusOutlined,
  UnorderedListOutlined
} from "@ant-design/icons";
import { addTracksToPlaylist, getPlaylists, loadMoreTrack, type Playlist } from "@soundx/services";
import { useInfiniteScroll } from "ahooks";
import {
  Button,
  Empty,
  Flex,
  List,
  message,
  Modal,
  Skeleton,
  theme,
  Typography
} from "antd";
import React, { useRef, useState } from "react";
import TrackList from "../../components/TrackList";
import { type Track } from "../../models";
import { downloadTracks } from "../../services/downloadManager";
import { useAuthStore } from "../../store/auth";
import { usePlayerStore } from "../../store/player";
import { usePlayMode } from "../../utils/playMode";
import styles from "./index.module.less";

const { Title } = Typography;

interface Result {
  list: Track[];
  hasMore: boolean;
  nextId?: number;
}

const Songs: React.FC = () => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { token } = theme.useToken();
  const { play, setPlaylist, insertTracksNext } = usePlayerStore();
  const { user } = useAuthStore();
  const [messageApi, contextHolder] = message.useMessage();

  // Selection Mode
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  
  // Batch Add to Playlist
  const [isBatchAddModalOpen, setIsBatchAddModalOpen] = useState(false);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);


  const { mode } = usePlayMode();

  const loadMore = async (d: Result | undefined): Promise<Result> => {
    const currentLoadCount = d?.nextId || 0;
    const pageSize = 50;

    try {
      const res = await loadMoreTrack({
        pageSize,
        loadCount: currentLoadCount,
        type: mode === "MUSIC" ? "MUSIC" : "AUDIOBOOK"
      });
      console.log(res, 'res');
      if (res.code === 200 && res.data) {
        // Handle different return shapes if necessary, but Adapter returns ILoadMoreData<Track>
        // Native returns Track[], Subsonic returns Track[] in data.list usually. 
        // Wait, NativeTrackAdapter.loadMoreTrack returns ISuccessResponse<ILoadMoreData<Track>>
        // which has list: Track[], hasMore: boolean etc?
        // Let's check NativeTrackAdapter implementation again from previous turns.
        // It returns { list: Track[], total: number, hasMore: boolean } usually in ILoadMoreData.
        // BUT NativeTrackAdapter code showed it returning Request.get<... ILoadMoreData<Track>>
        // Let's assume standard ILoadMoreData structure.
        
        const list = res.data.list;
        const previousList = d?.list || [];

        return {
            list: [...previousList, ...list],
            hasMore: list.length === pageSize,
            nextId: currentLoadCount + 1,
        };
      }
    } catch (error) {
       console.error("Failed to fetch songs:", error);
    }

    return {
      list: d?.list || [],
      hasMore: false,
    };
  };

  const { data, loading, loadingMore, reload } = useInfiniteScroll(
    loadMore,
    {
      target: scrollRef,
      isNoMore: (d) => !d?.hasMore,
      reloadDeps: [mode],
    }
  );

  const handlePlayAll = () => {
    if (data?.list.length) {
      setPlaylist(data.list);
      play(data.list[0]);
    }
  };

  const handleToggleSelectionMode = () => {
    setIsSelectionMode(!isSelectionMode);
    setSelectedRowKeys([]);
  };

  const selectedTracks = data?.list.filter(t => selectedRowKeys.includes(t.id)) || [];

  const handleBatchDownload = async () => {
    if (!selectedTracks.length) return;
    messageApi.info(`开始下载 ${selectedTracks.length} 首歌曲`);
    await downloadTracks(selectedTracks, (completed, total) => {
        if (completed === total) {
            messageApi.success(`成功下载 ${total} 首歌曲`);
            setIsSelectionMode(false);
            setSelectedRowKeys([]);
        }
    });
  };

  const handleBatchAddToQueue = () => {
    if (!selectedTracks.length) return;
    insertTracksNext(selectedTracks);
    messageApi.success(`已添加 ${selectedTracks.length} 首歌曲到下一首播放`);
    setIsSelectionMode(false);
    setSelectedRowKeys([]);
  };

  const openBatchAddToPlaylist = async () => {
    if (!selectedTracks.length) return;
    setIsBatchAddModalOpen(true);
    try {
        const res = await getPlaylists(mode, user?.id);
        if (res.code === 200) {
            setPlaylists(res.data);
        }
    } catch (error) {
        messageApi.error("获取播放列表失败");
    }
  };

  const handleBatchAddToPlaylist = async (playlistId: number | string) => {
    try {
        const res = await addTracksToPlaylist(playlistId, selectedRowKeys as (string|number)[]);
        if (res.code === 200) {
            messageApi.success("添加成功");
            setIsBatchAddModalOpen(false);
            setIsSelectionMode(false);
            setSelectedRowKeys([]);
        } else {
            messageApi.error("添加失败");
        }
    } catch (error) {
        messageApi.error("添加失败");
    }
  };

  const handleAddSelectionToCurrentPlaylist = () => {
      handleBatchAddToQueue();
      setIsBatchAddModalOpen(false);
  };

  return (
    <div ref={scrollRef} className={styles.container}>
      <div className={styles.pageHeader}>
        <Title level={2} className={styles.title}>
          单曲
        </Title>
        {isSelectionMode ? (
            <Flex gap={8}>
              <Button type="text" onClick={handleToggleSelectionMode} icon={<CloseOutlined />}>
                取消
              </Button>
              <div style={{ marginRight: 8, alignSelf: 'center' }}>
                已选择 {selectedRowKeys.length} 项
              </div>
              <Button 
                icon={<PlusOutlined />} 
                disabled={!selectedRowKeys.length}
                onClick={openBatchAddToPlaylist}
              >
                添加到...
              </Button>
              <Button 
                icon={<DownloadOutlined />} 
                disabled={!selectedRowKeys.length}
                onClick={handleBatchDownload}
              >
                下载
              </Button>
            </Flex>
        ) : (
            <Flex gap={8} align="center">
              <Button 
                icon={<PlayCircleOutlined />} 
                onClick={handlePlayAll}
                disabled={!data?.list.length}
              >
                播放全部
              </Button>
              <Button
                icon={<CheckSquareOutlined />}
                onClick={handleToggleSelectionMode}
              >
                批量操作
              </Button>
            </Flex>
        )}
      </div>

      <div style={{ padding: '0 24px' }}>
          {contextHolder}
          <TrackList
            tracks={data?.list || []}
            showIndex={true}
            showArtist={true}
            showAlbum={true}
            onPlay={(track, tracks) => {
              if (isSelectionMode) return;
              setPlaylist(tracks);
              play(track, track.albumId);
            }}
            onRefresh={reload}
            rowSelection={isSelectionMode ? {
                selectedRowKeys,
                onChange: (keys: React.Key[]) => setSelectedRowKeys(keys),
            } : undefined}
          />
      </div>

      <Modal
        title="添加到播放列表"
        open={isBatchAddModalOpen}
        onCancel={() => setIsBatchAddModalOpen(false)}
        footer={null}
      >
        <List
            header={
                <List.Item
                    onClick={handleAddSelectionToCurrentPlaylist}
                    style={{ cursor: "pointer", borderBottom: `1px solid ${token.colorBorderSecondary}` }}
                    className={styles.playlistItem} // Reuse if possible or plain style
                >
                    <List.Item.Meta
                        avatar={<PlaySquareOutlined style={{ fontSize: 24, color: token.colorPrimary }} />}
                        title={<span style={{ color: token.colorText }}>当前播放列表</span>}
                        description="插入到正在播放之后"
                    />
                </List.Item>
            }
            dataSource={playlists}
            renderItem={(item) => (
            <List.Item
                onClick={() => handleBatchAddToPlaylist(item.id)}
                style={{ cursor: "pointer" }}
            >
                <List.Item.Meta
                    avatar={<UnorderedListOutlined style={{ fontSize: 20 }} />}
                    title={item.name}
                    description={`${item._count?.tracks || 0} 首`}
                />
            </List.Item>
            )}
            style={{ maxHeight: 400, overflowY: 'auto' }}
        />
      </Modal>

      {(loading || loadingMore) && (
        <div className={styles.loadingContainer}>
          <div style={{ padding: '0 24px' }}>
             <Skeleton active />
             <Skeleton active />
          </div>
        </div>
      )}

      {data && !data.hasMore && data.list.length > 0 && (
        <div className={styles.noMore}>没有更多了</div>
      )}

      {data?.list.length === 0 && !loading && (
        <div
          className={styles.noData}
          style={{ color: token.colorTextSecondary }}
        >
          <Empty description="暂无歌曲" />
        </div>
      )}
    </div>
  );
};

export default Songs;
