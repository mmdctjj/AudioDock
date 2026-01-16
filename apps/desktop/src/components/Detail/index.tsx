import {
    CaretRightOutlined,
    CloudDownloadOutlined,
    HeartFilled,
    HeartOutlined,
    SearchOutlined,
    SortAscendingOutlined,
    SortDescendingOutlined,
} from "@ant-design/icons";
import {
    getAlbumById,
    getAlbumTracks,
    toggleAlbumLike,
    unlikeAlbum,
} from "@soundx/services";
import { useRequest } from "ahooks";
import { Avatar, Col, Flex, Input, Row, theme, Typography } from "antd";
import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useMessage } from "../../context/MessageContext";
import { type Album, type Track } from "../../models";
import { downloadTracks } from "../../services/downloadManager";
import { useAuthStore } from "../../store/auth";
import { usePlayerStore } from "../../store/player";
import { getCoverUrl } from "../../utils";
import TrackList from "../TrackList";
import styles from "./index.module.less";

const { Title, Text } = Typography;

const Detail: React.FC = () => {
  const message = useMessage();
  const [searchParams] = useSearchParams();
  const id = searchParams.get("id");
  const { user } = useAuthStore();

  const [album, setAlbum] = useState<Album | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const [sort, setSort] = useState<"asc" | "desc">("asc");
  const [keyword, setKeyword] = useState("");
  const [keywordMidValue, setKeywordMidValue] = useState("");
  const [isLiked, setIsLiked] = useState(false);

  const { token } = theme.useToken();
  const { play, setPlaylist } = usePlayerStore();

  const pageSize = 20;

  const { run: likeAlbum } = useRequest(toggleAlbumLike, {
    manual: true,
    onSuccess: (res) => {
      if (res.code === 200) {
        setIsLiked(true);
        message.success("收藏成功");
      }
    },
  });

  const { run: unlikeAlbumRequest } = useRequest(unlikeAlbum, {
    manual: true,
    onSuccess: (res) => {
      if (res.code === 200) {
        setIsLiked(false);
        message.success("已取消收藏");
      }
    },
  });

  useEffect(() => {
    if (id) {
      fetchAlbumDetails(Number(id));
      // Reset list when id changes
      setTracks([]);
      setPage(0);
      setHasMore(true);
      fetchTracks(Number(id), 0, sort, keyword);
    }
  }, [id, sort, keyword]);

  const fetchAlbumDetails = async (albumId: number) => {
    try {
      const res = await getAlbumById(albumId);
      if (res.code === 200) {
        setAlbum(res.data);
        // Check if liked by current user
        // @ts-ignore
        const likedByUsers = res.data.likedByUsers || [];
        const isLikedByCurrentUser = likedByUsers.some(
          (like: any) => like.userId === user?.id
        );
        setIsLiked(isLikedByCurrentUser);
      }
    } catch (error) {
      console.error("Failed to fetch album details:", error);
    }
  };

  const fetchTracks = async (
    albumId: number,
    currentPage: number,
    currentSort: "asc" | "desc",
    currentKeyword: string
  ) => {
    if (loading) return;
    setLoading(true);
    try {
      const res = await getAlbumTracks(
        albumId,
        pageSize,
        currentPage * pageSize,
        currentSort,
        currentKeyword,
        user?.id
      );
      if (res.code === 200) {
        const newTracks = res.data.list;
        // Ensure albumName is populated if needed by TrackList (though we pass explicit album name usually? TrackList uses track.album)
        // Tracks from getAlbumTracks probably have album data or not?
        if (currentPage === 0) {
          setTracks(newTracks);
        } else {
          setTracks((prev) => [...prev, ...newTracks]);
        }
        setHasMore(newTracks.length === pageSize);
        setPage(currentPage + 1);
      }
    } catch (error) {
      console.error("Failed to fetch tracks:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, clientHeight, scrollHeight } = e.currentTarget;
    if (
      scrollHeight - scrollTop === clientHeight &&
      hasMore &&
      !loading &&
      id
    ) {
      fetchTracks(Number(id), page, sort, keyword);
    }
  };

  const handlePlayAll = () => {
    if (tracks.length > 0 && album) {
      setPlaylist(tracks);
      play(tracks[0], album.id);
    }
  };

  const handleRefresh = () => {
    // When a track is deleted or updated, we should refresh the list.
    // Ideally we re-fetch the current view.
    if (!id) return;
    // Simple approach: reset
    setTracks([]);
    setPage(0);
    setHasMore(true);
    fetchTracks(Number(id), 0, sort, keyword);
  };

  return (
    <div
      className={styles.detailContainer}
      onScroll={handleScroll}
      style={{ overflowY: "auto", height: "100%" }}
    >
      {/* Header Banner */}
      <div
        className={styles.banner}
        style={{
          backgroundImage: `url(${getCoverUrl(album, album?.id)})`,
        }}
      >
        <div className={styles.bannerOverlay}></div>

        <Flex align="center" gap={16} className={styles.bannerContent}>
          <Avatar size={50} src={getCoverUrl(album, album?.id)} />
          <Flex vertical gap={0}>
            <Title level={4} style={{ color: "#fff", margin: 0 }}>
              {album?.name || "Unknown Album"}
            </Title>
            <Text type="secondary" style={{ color: "#ccc" }}>
              {album?.artist || "Unknown Artist"}
            </Text>
          </Flex>
        </Flex>
      </div>

      <div className={styles.contentPadding} style={{ color: token.colorText }}>
        <Row gutter={40}>
          {/* Main Content */}
          <Col span={24}>
            {/* Controls */}
            <div className={styles.controlsRow}>
              <div className={styles.mainControls}>
                <div
                  className={styles.playButton}
                  style={{
                    backgroundColor: `rgba(255, 255, 255, 0.1)`,
                    border: `0.1px solid ${token.colorTextSecondary}`,
                  }}
                >
                  <CaretRightOutlined
                    onClick={handlePlayAll}
                    style={{
                      color: token.colorTextSecondary,
                      fontSize: "30px",
                    }}
                  />
                </div>
                <Typography.Text
                  type="secondary"
                  className={styles.actionGroup}
                >
                  {isLiked ? (
                    <HeartFilled
                      className={styles.actionIcon}
                      style={{ color: "#ff4d4f" }}
                      onClick={() =>
                        album && user?.id && unlikeAlbumRequest(album.id, user.id)
                      }
                    />
                  ) : (
                    <HeartOutlined
                      className={styles.actionIcon}
                      onClick={() =>
                        album && user?.id && likeAlbum(album.id, user.id)
                      }
                    />
                  )}
                  <CloudDownloadOutlined 
                    className={styles.actionIcon} 
                    onClick={() => {
                        if (tracks.length === 0) {
                            message.warning("无可下载的曲目");
                            return;
                        }
                        message.info(`开始下载专辑《${album?.name}》`);
                        downloadTracks(tracks, (completed: number, total: number) => {
                            if (completed === total) {
                                message.success(`专辑《${album?.name || ''}》下载完成`);
                            }
                        });
                    }}
                  />
                </Typography.Text>
              </div>

              <div
                style={{ display: "flex", alignItems: "center", gap: "15px" }}
              >
                <Input
                  prefix={
                    <SearchOutlined
                      style={{ color: token.colorTextSecondary }}
                    />
                  }
                  className={styles.searchInput}
                  onChange={(e) => setKeywordMidValue(e.target.value)}
                  onPressEnter={() => setKeyword(keywordMidValue)}
                />
                {sort === "desc" ? (
                  <SortAscendingOutlined
                    className={styles.actionIcon}
                    style={{ fontSize: "18px" }}
                    onClick={() => setSort("asc")}
                  />
                ) : (
                  <SortDescendingOutlined
                    className={styles.actionIcon}
                    style={{ fontSize: "18px" }}
                    onClick={() => setSort("desc")}
                  />
                )}
              </div>
            </div>

            {/* Track List */}
            <TrackList
              tracks={tracks}
              loading={loading}
              type={album?.type}
              onRefresh={handleRefresh}
            />
          </Col>
        </Row>
      </div>
    </div>
  );
};

export default Detail;
