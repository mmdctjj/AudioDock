import {
  CustomerServiceOutlined,
  DatabaseOutlined,
  DeleteOutlined,
  FolderOutlined,
  GithubOutlined,
  HeartOutlined,
  ImportOutlined,
  LeftOutlined,
  LogoutOutlined,
  ReadOutlined,
  ReloadOutlined,
  RetweetOutlined,
  RightOutlined,
  RollbackOutlined,
  SearchOutlined,
  SettingOutlined,
} from "@ant-design/icons";
import {
  addSearchRecord,
  check,
  clearSearchHistory,
  createImportTask,
  getHotSearches,
  getImportTask,
  getRunningImportTask,
  getSearchHistory,
  searchAll,
  setServiceConfig,
  SOURCEMAP,
  SOURCETIPSMAP,
  TaskStatus,
  useNativeAdapter,
  useSubsonicAdapter,
  type ImportTask,
  type SearchResults as SearchResultsType,
} from "@soundx/services";
import {
  Button,
  Flex,
  Input,
  Modal,
  Popover,
  Progress,
  Segmented,
  theme,
  Tooltip,
  Typography,
} from "antd";
import React, { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useMessage } from "../../context/MessageContext";
import { useTheme } from "../../context/ThemeContext";
import { TrackType } from "../../models";
import { useAuthStore } from "../../store/auth";
import { isSubsonicSource } from "../../utils";
import { isWindows } from "../../utils/platform";
import { usePlayMode } from "../../utils/playMode";
import SearchResults from "../SearchResults";
import styles from "./index.module.less";

import ctjj from "../../assets/ctjj.png";
import emby from "../../assets/emby.png";
import logo from "../../assets/logo.png";
import subsonic from "../../assets/subsonic.png";

const ServerSwitcherModal: React.FC<{
  onSelect: (url: string, type: string) => void;
}> = ({ onSelect }) => {
  const [sourceType, setSourceType] = useState<string>(
    () => localStorage.getItem("selectedSourceType") || "AudioDock",
  );
  const [history, setHistory] = useState<{ value: string }[]>([]);
  const { token: themeToken } = theme.useToken();

  useEffect(() => {
    const historyKey = `serverHistory_${sourceType}`;
    const data = localStorage.getItem(historyKey);
    if (data) {
      setHistory(JSON.parse(data));
    } else {
      setHistory(
        sourceType === "AudioDock" ? [{ value: "http://localhost:3000" }] : [],
      );
    }
  }, [sourceType]);

  const sourceOptions = Object.keys(SOURCEMAP).map((key) => ({
    label: (
      <Flex gap={8} align="center">
        {key === "Emby" ? (
          <img style={{ width: 24 }} src={emby} />
        ) : key === "Subsonic" ? (
          <img style={{ width: 24 }} src={subsonic} />
        ) : (
          <img style={{ width: 24 }} src={logo} />
        )}
        <span>{key}</span>
      </Flex>
    ),
    value: key,
    disabled: key === "Emby",
  }));

  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ marginBottom: 16 }}>
        <Segmented
          options={sourceOptions}
          value={sourceType}
          onChange={(val) => setSourceType(val as string)}
          block
        />
      </div>
      <div
        style={{
          marginBottom: 16,
          fontSize: 12,
          color: themeToken.colorTextSecondary,
        }}
      >
        {SOURCETIPSMAP[sourceType as keyof typeof SOURCETIPSMAP]}
      </div>
      <Flex vertical gap={8} style={{ maxHeight: 300, overflowY: "auto" }}>
        {history.map((item) => (
          <Button
            key={item.value}
            onClick={() => onSelect(item.value, sourceType)}
            type={
              localStorage.getItem("serverAddress") === item.value &&
              localStorage.getItem("selectedSourceType") === sourceType
                ? "primary"
                : "default"
            }
            style={{ textAlign: "left", height: "auto", padding: "8px 16px" }}
          >
            {item.value}
          </Button>
        ))}
        {history.length === 0 && (
          <div
            style={{
              textAlign: "center",
              padding: 20,
              color: themeToken.colorTextTertiary,
            }}
          >
            暂无历史记录
          </div>
        )}
      </Flex>
    </div>
  );
};

const Header: React.FC = () => {
  const message = useMessage();
  const navigate = useNavigate();
  const location = useLocation();
  const {} = useTheme();
  const { token } = theme.useToken();
  const pollTimerRef = useRef<number | null>(null);
  const [modal, contextHolder] = Modal.useModal();

  // Search state
  const [searchKeyword, setSearchKeyword] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResultsType | null>(
    null,
  );
  const [showResults, setShowResults] = useState(false);
  const searchTimerRef = useRef<number | null>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [hotSearches, setHotSearches] = useState<
    { keyword: string; count: number }[]
  >([]);

  // Mode state: 'music' | 'audiobook'
  const { mode: playMode, setMode: setPlayMode } = usePlayMode();
  const { logout, user } = useAuthStore();

  // Import task state
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isDonationModalOpen, setIsDonationModalOpen] = useState(false);
  const [importTask, setImportTask] = useState<ImportTask | null>(null);

  const fetchSearchMeta = async () => {
    try {
      const [historyRes, hotRes] = await Promise.all([
        getSearchHistory(),
        getHotSearches(),
      ]);
      if (historyRes.code === 200) setSearchHistory(historyRes.data);
      if (hotRes.code === 200) setHotSearches(hotRes.data);
    } catch (e) {
      console.error("Failed to fetch search meta", e);
    }
  };

  const handleClearHistory = async () => {
    try {
      await clearSearchHistory();
      setSearchHistory([]);
    } catch (e) {
      message.error("清空历史失败");
    }
  };

  const handleSelectKeyword = (keyword: string) => {
    setSearchKeyword(keyword);
    performSearch(keyword);
  };

  const performSearch = async (value: string) => {
    try {
      const type = playMode;
      const results = await searchAll(value.trim(), type);
      setSearchResults(results);
      setShowResults(true);
      // Save record
      addSearchRecord(value.trim());
    } catch (error) {
      console.error("Search error:", error);
    }
  };

  const handleLogout = () => {
    logout();
    message.success("已退出登录");
    // Optionally reload to reset app state
    window.location.reload();
  };

  // ... inside component
  const togglePlayMode = () => {
    document.body.style.transition = "transform 0.25s ease";
    document.body.style.transform = "scaleX(-1)"; // 开启
    setTimeout(() => {
      // 1. Save current path for the current mode
      const currentPath = location.pathname + location.search + location.hash;
      localStorage.setItem(`route_history_${playMode}`, currentPath);

      // 2. Determine new mode
      const newMode =
        playMode === TrackType.MUSIC ? TrackType.AUDIOBOOK : TrackType.MUSIC;

      // 3. Restore path for the new mode
      const savedPath = localStorage.getItem(`route_history_${newMode}`);
      // Default to root if no history, or maybe we want specific defaults per mode
      const targetPath = savedPath || "/";

      navigate(targetPath);
      setPlayMode(newMode);

      document.body.style.transform = ""; // 关闭
    }, 250);

    // Reload to apply changes globally if needed, though usePlayMode handles reactivity
    // window.location.reload(); // Removed reload as we now have reactive state
  };

  const iconStyle = { color: token.colorTextSecondary };
  const actionIconStyle = { color: token.colorText };

  const handleUpdateLibrary = async (mode: "incremental" | "full") => {
    message.loading(
      `${mode === "incremental" ? "增量" : "全量"}更新任务创建中...`,
    );

    try {
      const res = await createImportTask({ mode });
      if (res.code === 200 && res.data) {
        const taskId = res.data.id;
        setIsImportModalOpen(true);
        setImportTask({ id: taskId, status: TaskStatus.INITIALIZING });

        // Clear previous timer if any
        if (pollTimerRef.current) clearInterval(pollTimerRef.current);

        pollTimerRef.current = setInterval(() => {
          pollTaskStatus(taskId);
        }, 1000);
      } else {
        message.error(res.message || "任务创建失败");
      }
    } catch (error) {
      console.error("Task creation error:", error);
      message.error("创建任务失败，请检查网络或后端服务");
    }
  };

  const pollTaskStatus = async (taskId: string) => {
    try {
      const res = await getImportTask(taskId);
      if (res.code === 200 && res.data) {
        setImportTask(res.data);
        const { status, total } = res.data;
        if (status === TaskStatus.SUCCESS) {
          message.success(`导入成功！共导入 ${total} 首歌曲`);
          if (pollTimerRef.current) clearInterval(pollTimerRef.current);
          // Auto close modal after a short delay
          setTimeout(() => setIsImportModalOpen(false), 2000);
        } else if (status === TaskStatus.FAILED) {
          if (pollTimerRef.current) clearInterval(pollTimerRef.current);
        }
      }
    } catch (error) {
      console.error("Poll error:", error);
      // Don't stop polling on transient network errors, but maybe limit retries?
      // For simplicity, we just log.
    }
  };

  // Search handlers
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchKeyword(value);

    if (!value.trim()) {
      setSearchResults(null);
    }
  };

  const handleCloseSearch = () => {
    setShowResults(false);
  };

  // Click outside to close search results
  useEffect(() => {
    check().then((res) => {
      if (res.code == 200) {
      } else if (res.code === 401) {
        message.error("登录信息已过期，请重新登录");
        logout();
      }
    });
    const handleClickOutside = (event: MouseEvent) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(event.target as Node)
      ) {
        setShowResults(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (user) {
      // Check if there's a task running on server
      getRunningImportTask().then((taskRes) => {
        if (taskRes.code === 200 && taskRes.data) {
          const taskId = taskRes.data.id;
          setImportTask(taskRes.data);
          setIsImportModalOpen(true);

          if (pollTimerRef.current) clearInterval(pollTimerRef.current);
          pollTimerRef.current = setInterval(() => {
            pollTaskStatus(taskId);
          }, 1000);
        }
      });
    }
  }, [user]);

  return (
    <div className={styles.header}>
      {/* Navigation Controls */}
      <div className={styles.navControls}>
        <div className={styles.navGroup}>
          <Tooltip title="后退">
            <LeftOutlined
              onClick={() => navigate(-1)}
              className={styles.navIcon}
              style={iconStyle}
            />
          </Tooltip>
          <Tooltip title="前进">
            <RightOutlined
              onClick={() => navigate(1)}
              className={styles.navIcon}
              style={iconStyle}
            />
          </Tooltip>
          <Tooltip title="刷新">
            <ReloadOutlined
              onClick={() => window.location.reload()}
              className={styles.navIcon}
              style={iconStyle}
            />
          </Tooltip>
        </div>
      </div>

      {/* Search Bar */}
      <div className={styles.searchBar} ref={searchContainerRef}>
        <Input
          prefix={
            <SearchOutlined style={{ color: token.colorTextSecondary }} />
          }
          placeholder="搜索单曲、艺术家、专辑"
          bordered={false}
          className={styles.searchInput}
          style={{ color: token.colorText }}
          value={searchKeyword}
          onChange={handleSearchChange}
          onPressEnter={() => {
            if (searchKeyword.trim()) {
              performSearch(searchKeyword.trim());
            }
          }}
          onFocus={() => {
            setShowResults(true);
            fetchSearchMeta();
          }}
        />
        {showResults && (
          <SearchResults
            results={searchResults}
            onClose={handleCloseSearch}
            history={searchHistory}
            hotSearches={hotSearches}
            onSelectKeyword={handleSelectKeyword}
            onClearHistory={handleClearHistory}
          />
        )}
      </div>

      {/* User Actions */}
      <div className={styles.userActions}>
        {!isSubsonicSource() && (
          <Tooltip
            title={
              playMode === TrackType.MUSIC
                ? "切换至有声书模式"
                : "切换至音乐模式"
            }
          >
            <div
              onClick={togglePlayMode}
              className={styles.actionIcon}
              style={actionIconStyle}
            >
              {playMode === TrackType.MUSIC ? (
                <CustomerServiceOutlined />
              ) : (
                <ReadOutlined />
              )}
            </div>
          </Tooltip>
        )}

        <Tooltip title="mini播放器">
          <ImportOutlined
            className={styles.actionIcon}
            style={actionIconStyle}
            onClick={() => {
              if ((window as any).ipcRenderer) {
                (window as any).ipcRenderer.send("window:set-mini");
              }
            }}
          />
        </Tooltip>

        {!isSubsonicSource() && (
          <Tooltip title="文件夹">
            <div
              className={styles.actionIcon}
              style={actionIconStyle}
              onClick={() => {
                navigate(`/folders`);
              }}
            >
              <FolderOutlined />
            </div>
          </Tooltip>
        )}

        <Tooltip title="切换服务端">
          <div
            className={styles.actionIcon}
            style={actionIconStyle}
            onClick={() => {
              const handleSwitchServer = (url: string, type: string) => {
                const mappedType =
                  SOURCEMAP[type as keyof typeof SOURCEMAP] || "audiodock";

                // 1. Update localStorage
                localStorage.setItem("serverAddress", url);
                localStorage.setItem("selectedSourceType", type);
                localStorage.setItem(`serverAddress_${type}`, url);

                // 2. Load credentials if available
                const credsKey = `creds_${type}_${url}`;
                const savedCreds = localStorage.getItem(credsKey);
                let username = undefined;
                let password = undefined;
                if (savedCreds) {
                  const creds = JSON.parse(savedCreds);
                  username = creds.username;
                  password = creds.password;
                }

                // 3. Configure service and adapter
                setServiceConfig({
                  username,
                  password,
                  clientName: "SoundX Desktop",
                });

                if (mappedType === "subsonic") {
                  useSubsonicAdapter();
                } else {
                  useNativeAdapter();
                }

                // 4. Update auth store
                useAuthStore.getState().switchServer(url);

                // 5. Cleanup and reload
                Modal.destroyAll();
                message.success(`已切换至 ${type} 服务端: ${url}`);
                window.location.reload();
              };

              modal.confirm({
                title: "切换服务端",
                content: <ServerSwitcherModal onSelect={handleSwitchServer} />,
                footer: null,
                closable: true,
                width: 460,
              });
            }}
          >
            <DatabaseOutlined />
          </div>
        </Tooltip>
        <Popover
          content={
            <div className={styles.userMenu}>
              <div className={styles.userMenuItem}>
                嗨！{user?.username || "未知"}
              </div>
              <div
                className={styles.userMenuItem}
                onClick={() => {
                  if (window.ipcRenderer) {
                    window.ipcRenderer?.openExternal(
                      "https://github.com/mmdctjj/AudioDock",
                    );
                  } else {
                    window.open(
                      "https://github.com/mmdctjj/AudioDock",
                      "_blank",
                    );
                  }
                }}
              >
                <GithubOutlined />求 Star！！！
              </div>
              <div
                className={styles.userMenuItem}
                onClick={() => {
                  modal.confirm({
                    title: "确认增量更新？",
                    content: "增量更新只增加新数据，不删除旧数据",
                    okText: "确认更新",
                    cancelText: "取消",
                    onOk: () => handleUpdateLibrary("incremental"),
                  });
                }}
              >
                <RollbackOutlined />
                增量更新音频文件
              </div>
              <div
                className={styles.userMenuItem}
                onClick={() => {
                  modal.confirm({
                    title: "确认全量更新？",
                    content:
                      "全量更新将清空所有歌曲、专辑、艺术家、播放列表以及您的播放历史和收藏记录！此操作不可恢复。",
                    okText: "确认清空并更新",
                    cancelText: "取消",
                    onOk: () => handleUpdateLibrary("full"),
                  });
                }}
              >
                <RetweetOutlined />
                全量更新音频文件
              </div>
              <div
                className={styles.userMenuItem}
                onClick={() => setIsDonationModalOpen(true)}
              >
                <HeartOutlined />
                赞赏我
              </div>
              <div className={styles.userMenuItem}>
                <DeleteOutlined />
                清空缓存文件
              </div>

              <div
                className={styles.userMenuItem}
                onClick={() => navigate("/settings")}
              >
                <SettingOutlined className={styles.actionIcon} />
                设置
              </div>
              <div className={styles.userMenuItem} onClick={handleLogout}>
                <LogoutOutlined />
                退出登陆
              </div>
            </div>
          }
        >
          <Flex
            gap={12}
            align="center"
            style={{ paddingRight: isWindows() ? "140px" : "0" }}
          >
            <div className={styles.avatar}>
              <img
                src="https://api.dicebear.com/7.x/avataaars/svg?seed=Felix"
                alt="avatar"
              />
            </div>
          </Flex>
        </Popover>
      </div>
      {contextHolder}
      <Modal
        title="数据入库进度"
        open={isImportModalOpen}
        onCancel={() => {
          if (
            importTask?.status === TaskStatus.SUCCESS ||
            importTask?.status === TaskStatus.FAILED
          ) {
            setIsImportModalOpen(false);
          } else {
            message.info("任务正在后台运行...");
            setIsImportModalOpen(false);
          }
        }}
        footer={null}
        destroyOnClose
      >
        <div style={{ padding: "20px 0" }}>
          <div style={{ marginBottom: 16 }}>
            状态：
            {importTask?.status === TaskStatus.INITIALIZING
              ? "正在初始化..."
              : importTask?.status === TaskStatus.PARSING
                ? "正在解析媒体文件..."
                : importTask?.status === TaskStatus.SUCCESS
                  ? "入库完成"
                  : importTask?.status === TaskStatus.FAILED
                    ? "入库失败"
                    : "准备中"}
          </div>
          {importTask?.status === TaskStatus.FAILED && (
            <div style={{ color: token.colorError, marginBottom: 16 }}>
              错误：{importTask.message}
            </div>
          )}
          <Progress
            percent={
              importTask?.total
                ? Math.round(
                    ((importTask.current || 0) / importTask.total) * 100,
                  )
                : 0
            }
            status={
              importTask?.status === TaskStatus.FAILED
                ? "exception"
                : importTask?.status === TaskStatus.SUCCESS
                  ? "success"
                  : "active"
            }
          />
          <div
            style={{
              marginTop: 8,
              textAlign: "right",
              color: token.colorTextSecondary,
            }}
          >
            共检测到 {importTask?.total || 0} 个音频文件，已经入库{" "}
            {importTask?.current || 0} 个
          </div>
        </div>
      </Modal>

      <Modal
        title="赞赏开发者"
        open={isDonationModalOpen}
        onCancel={() => setIsDonationModalOpen(false)}
        footer={null}
        width={340}
        centered
      >
        <div style={{ textAlign: "center", padding: "10px 0" }}>
          <Typography.Text
            type="secondary"
            style={{ marginBottom: 16, display: "block" }}
          >
            如果您觉得 AudioDock 对您有帮助
            <br />
            欢迎赞赏支持！
          </Typography.Text>
          <img
            src={ctjj}
            alt="Donation QR Code"
            style={{
              width: "100%",
              maxWidth: 280,
              borderRadius: 8,
              boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
            }}
          />
        </div>
      </Modal>
    </div>
  );
};

export default Header;
