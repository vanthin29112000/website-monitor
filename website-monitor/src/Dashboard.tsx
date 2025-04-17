import React, { useEffect, useState } from "react";
import axios from "axios";
import { Card, Tag, Row, Col, Alert, Button, Modal } from "antd";
import {
  CheckCircleTwoTone,
  CloseCircleTwoTone,
  LoadingOutlined,
} from "@ant-design/icons";
import websites from "./website.json";
const REFRESH_INTERVAL = 300000; // 60 giây


type StatusType = "online" | "offline" | "checking";

interface SiteStatus {
  name: string;
  url: string;
  status: StatusType;
  isIframe?: boolean;
  screenshot?: string;
}

const Dashboard: React.FC = () => {
  const [statusList, setStatusList] = useState<SiteStatus[]>(websites.map((site) => ({ ...site, status: "checking" })));
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL / 1000);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const checkWebsites = async () => {
    const es = new EventSource('http://localhost:5000/api/status/stream');
  
    es.onmessage = (e) => {
      const data = JSON.parse(e.data);
      // cập nhật 1 site trong statusList
      setStatusList(prev =>
        prev.map(s =>
          s.name === data.name
            ? { ...s, status: data.status, loadTime: data.loadTime, screenshot: data.screenshot }
            : s
        )
      );
    };
  
    es.addEventListener('done', () => {
      es.close();
    });
  
    return () => {
      es.close();
    };
  };

  useEffect(() => {
    checkWebsites(); // gọi 1 lần lúc load
  
    const checkInterval = setInterval(() => {
      checkWebsites(); // gọi lại định kỳ
    }, REFRESH_INTERVAL);
  
    const countdownTimer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          window.location.reload(); // reload khi hết thời gian
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  
    setCountdown(REFRESH_INTERVAL / 1000); // khởi tạo countdown ban đầu
  
    return () => {
      clearInterval(checkInterval);
      clearInterval(countdownTimer);
    };
  }, []);

  // useEffect(() => {
    
  // }, []);
  

  const renderStatus = (status: StatusType) => {
    switch (status) {
      case "online":
        return (
          <Tag
            icon={<CheckCircleTwoTone twoToneColor="#52c41a" />}
            color="success"
          >
            Online
          </Tag>
        );
      case "offline":
        return (
          <Tag
            icon={<CloseCircleTwoTone twoToneColor="#ff4d4f" />}
            color="error"
          >
            Offline
          </Tag>
        );
      default:
        return (
          <Tag icon={<LoadingOutlined spin />} color="processing">
            Checking
          </Tag>
        );
    }
  };

  return (
    <div style={{ position: "relative", minHeight: "100vh" }}>
      <Row gutter={[16, 16]} style={{ padding: 16 }}>
        {statusList.map((site, idx) => (
          <Col xs={24} sm={12} md={4} key={idx}>
            <Card
              title={site.name}
              extra={renderStatus(site.status) }
              style={{boxShadow: "0px 4px 8px rgba(0, 0, 0, 0.2)"}}
              actions={[
                <Button type="link" href={site.url} target="_blank">
                  Mở tab mới
                </Button>,
              ]}
            >
              {site.screenshot ? (
  <img
    src={"http://localhost:5000" + site.screenshot}
    alt={`Screenshot of ${site.name}`}
    onClick={() =>
      setPreviewImage("http://localhost:5000" + site.screenshot)
    }
    style={{
      width: "100%",
      height: "250px",
      borderRadius: 6,
      border: "1px solid #ddd",
      objectFit: "fill",
      backgroundColor: "#f5f5f5",
      cursor: "pointer",
      transition: "transform 0.2s",
    }}
    onMouseEnter={(e) =>
      (e.currentTarget.style.transform = "scale(1.02)")
    }
    onMouseLeave={(e) =>
      (e.currentTarget.style.transform = "scale(1)")
    }
  />
) : site.isIframe === false && site.status === "online" ? (
  <iframe
    src={site.url}
    title={site.name}
    width="100%"
    height="250"
    style={{
      border: "1px solid #ddd",
      borderRadius: 6,
      backgroundColor: "#f5f5f5",
    }}
  />
) : site.status === "offline" ? (
  <Alert type="error" showIcon message="Không thể truy cập trang" />
) : (
  <Alert
    type="info"
    showIcon
    message={
      site.isIframe === true
        ? "Không có ảnh chụp màn hình"
        : "Đang lấy thông tin"
    }
  />
)}
            </Card>
          </Col>
        ))}
      </Row>

      {/* Countdown fixed bottom-right */}
      <div
        style={{
          position: "fixed",
          bottom: 16,
          right: 24,
          backgroundColor: "#fff",
          padding: "8px 16px",
          borderRadius: 8,
          boxShadow: "0 0 8px rgba(0,0,0,0.1)",
          fontWeight: "bold",
          zIndex: 1000,
        }}
      >
        Tự động tải lại sau:{" "}
        <span
          style={{
            color: "red",
          }}
        >
          {countdown}s
        </span>
      </div>

      {/* Image preview modal */}
      <Modal
        open={!!previewImage}
        footer={null}
        onCancel={() => setPreviewImage(null)}
        width={800}
        centered
      >
        <img
          alt="Preview"
          style={{ width: "100%", borderRadius: 8 }}
          src={previewImage || ""}
        />
      </Modal>
    </div>
  );
};

export default Dashboard;
