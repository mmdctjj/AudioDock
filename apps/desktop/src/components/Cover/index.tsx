import {
  HeartFilled,
  HeartOutlined,
  MoreOutlined,
  PlayCircleOutlined,
} from "@ant-design/icons";
import { getAlbumById, getAlbumTracks, toggleAlbumLike, toggleAlbumUnLike } from "@soundx/services";
import type { MenuProps } from "antd";
import { Dropdown, Skeleton, theme, Typography } from "antd";
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMessage } from "../../context/MessageContext";
import type { Album, Track } from "../../models";
import { resolveArtworkUri } from "../../services/trackResolver";
import { useAuthStore } from "../../store/auth";
import { usePlayerStore } from "../../store/player";
import styles from "./index.module.less";

const { Title, Text } = Typography;

interface CoverComponent
  extends React.FC<{
    item: Album | Track;
    size?: number;
    isTrack?: boolean;
    onClick?: (item: Album | Track) => void;
  }> {
  Skeleton: React.FC;
}

const Cover: CoverComponent = ({ item, size, isTrack = false, onClick }) => {
  const message = useMessage();
  const navigate = useNavigate();
  const { play, setPlaylist } = usePlayerStore();
  const [isLiked, setIsLiked] = useState(false);
  const { user } = useAuthStore();

  useEffect(() => {
    // Check if album is liked
    if (!isTrack && (item as Album).id) {
      checkIfLiked((item as Album).id);
    }
  }, [item, isTrack]);

  const checkIfLiked = async (albumId: number | string) => {
    try {
      const res = await getAlbumById(albumId as unknown as number);
      if (res.code === 200) {
        // @ts-ignore - likedByUsers is included in response
        const likedByUsers = res.data.likedByUsers || [];
        const isLikedByCurrentUser = likedByUsers.some(
          (like: any) => like.userId === user?.id
        );
        setIsLiked(isLikedByCurrentUser);
      }
    } catch (error) {
      console.error("Failed to check like status:", error);
    }
  };

  const handleClick = () => {
    if (onClick) {
      onClick(item);
      return;
    }
    if (isTrack) {
      // For tracks, play directly
      play(item as Track);
      setPlaylist([item as Track]);
    } else {
      // For albums, navigate to detail page
      navigate(`/detail?id=${item.id}`);
    }
  };

  const handlePlayAlbum = async () => {
    if (isTrack) {
      play(item as Track);
      setPlaylist([item as Track]);
    } else {
      try {
        const res = await getAlbumTracks((item as Album).id, 100, 0);
        if (res.code === 200 && res.data.list.length > 0) {
          const tracks = res.data.list;
          setPlaylist(tracks);

          // Check for resume info
          const resumeTrackId = (item as any).resumeTrackId;
          const resumeProgress = (item as any).resumeProgress;

          let targetTrack = tracks[0];
          let startTime = 0;

          if (resumeTrackId) {
            const found = tracks.find((t) => t.id === resumeTrackId);
            if (found) {
              targetTrack = found;
              startTime = resumeProgress || 0;
            }
          }

          play(targetTrack, (item as Album).id, startTime);
          message.success(startTime > 0 ? "继续播放" : "开始播放");
        }
      } catch (error) {
        console.error(error);
        message.error("播放失败");
      }
    }
  };

  const handleToggleLike = async () => {
    if (isTrack) return;

    try {
      if (isLiked) {
        const res = await toggleAlbumUnLike((item as Album).id, user?.id || 0);
        if (res.code === 200) {
          setIsLiked(false);
          message.success("已取消收藏");
        }
      } else {
        const res = await toggleAlbumLike((item as Album).id, user?.id || 0);
        if (res.code === 200) {
          setIsLiked(true);
          message.success("收藏成功");
        }
      }
    } catch (error) {
      message.error("操作失败");
    }
  };

  const menuItems: MenuProps["items"] = [
    {
      key: "play",
      label: "播放",
      icon: <PlayCircleOutlined />,
      onClick: handlePlayAlbum,
    },
    {
      key: "like",
      label: isLiked ? "取消收藏" : "收藏",
      icon: isLiked ? (
        <HeartFilled style={{ color: "#ff4d4f" }} />
      ) : (
        <HeartOutlined />
      ),
      onClick: handleToggleLike,
    },
  ];

  return (
    <div
      className={styles.coverContainer}
      onClick={handleClick}
      style={size ? { width: size } : undefined}
    >
      <div className={styles.imageWrapper}>
        <img
          src={
            resolveArtworkUri(item) || `https://picsum.photos/seed/${item.id}/300/300`
          }
          alt={item.name}
          className={styles.image}
        />
        {!isTrack &&
          (item as Album).progress !== undefined &&
          (item as Album).progress! > 0 && (
            <div className={styles.progressBarWrapper}>
              <div
                className={styles.progressBar}
                style={{
                  width: `${(item as Album).progress}%`,
                  backgroundColor: theme.useToken().token.colorBgBase,
                }}
              />
            </div>
          )}
        {!isTrack && (
          <div className={styles.moreButton}>
            <Dropdown
              menu={{ items: menuItems }}
              trigger={["click"]}
              placement="bottomRight"
            >
              <MoreOutlined
                onClick={(e) => e.stopPropagation()}
                style={{ fontSize: "20px", cursor: "pointer" }}
              />
            </Dropdown>
          </div>
        )}
      </div>
      <Title level={5} className={styles.title}>
        {item.name}
      </Title>
      <Text type="secondary" className={styles.artist}>
        {item.artist}
      </Text>
    </div>
  );
};

Cover.Skeleton = () => {
  return (
    <div>
      <div className={styles.skeletonWrapper}>
        <Skeleton.Node active className={styles.skeletonNode}>
          <div style={{ width: "100%", height: "100%" }} />
        </Skeleton.Node>
      </div>
      <Skeleton
        active
        title={{ width: "80%", style: { height: "20px", marginBottom: "8px" } }}
        paragraph={{ rows: 1, width: "60%" }}
      />
    </div>
  );
};

export default Cover;
